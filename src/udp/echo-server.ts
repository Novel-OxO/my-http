import * as dgram from "node:dgram";
import { log } from "../tcp/log";

export type UdpEchoServerOptions = {
  port?: number;
  host?: string;
};

export type UdpEchoServerHandle = {
  socket: dgram.Socket;
  port: number;
  host: string;
  /** 누적 처리 메시지 수. 메시지 경계 보존 학습용. */
  messageCount: () => number;
  close: () => Promise<void>;
};

/**
 * UDP 에코 서버 팩토리.
 *
 * 학습 포인트 (TCP와의 차이):
 * - `dgram.createSocket('udp4')`에는 connection 콜백이 없다. UDP는 비연결형이라
 *   "이 소켓에 누가 붙었다"는 개념 자체가 없다. 서버는 그냥 한 소켓에서 모든
 *   송신자의 datagram을 받는다.
 * - 그래서 `'connection'` 이벤트도, 활성 소켓 추적도 의미 없다 (Phase 1과 비교).
 */
export function createUdpEchoServer(
  options: UdpEchoServerOptions = {},
): Promise<UdpEchoServerHandle> {
  const host = options.host ?? process.env.UDP_HOST ?? "127.0.0.1";
  const port = options.port ?? Number(process.env.UDP_PORT ?? 41234);

  const socket = dgram.createSocket("udp4");
  let messageCount = 0;

  /**
   * 학습 포인트 (메시지 경계 보존):
   * 클라이언트가 send를 N번 부르면 서버에서도 'message' 이벤트가 정확히 N번 난다.
   * (단, MTU를 초과하면 IP 단편화로 한 datagram이 여러 IP packet으로 쪼개질 수 있다.
   *  그래도 우리 'message' 콜백 입장에서는 단편화가 다시 합쳐져 한 번만 호출된다.)
   * TCP에서 socket.write 3번 → server 'data' 이벤트가 1~3번 임의 분할되는 것과 대비.
   */
  socket.on("message", (msg: Buffer, rinfo: dgram.RemoteInfo) => {
    messageCount += 1;
    log.debug(
      `udp message from ${rinfo.address}:${rinfo.port} bytes=${msg.length}`,
    );
    /**
     * 학습 포인트 (stateless / 명시적 주소):
     * TCP에서는 `socket.write(chunk)` 한 줄로 응답이 가지만, UDP는 누구한테
     * 보낼지 매번 명시해야 한다. rinfo만이 송신자 식별 단서다.
     */
    socket.send(msg, rinfo.port, rinfo.address, (err) => {
      if (err) log.debug(`send error: ${err.message}`);
    });
  });

  socket.on("error", (err) => log.error(`udp socket error: ${err.message}`));
  socket.on("close", () => log.debug("udp socket closed"));

  return new Promise<UdpEchoServerHandle>((resolve, reject) => {
    socket.once("error", reject);
    socket.bind(port, host, () => {
      socket.removeListener("error", reject);
      const addr = socket.address();
      log.info(`udp echo server listening on ${addr.address}:${addr.port}`);
      resolve({
        socket,
        port: addr.port,
        host: addr.address,
        messageCount: () => messageCount,
        close: () =>
          new Promise<void>((res) => {
            // dgram socket.close에는 콜백 인자가 있고 'close' 이벤트도 발생한다.
            // 두 경로 중 빠른 쪽으로 종료.
            socket.close(() => res());
          }),
      });
    });
  });
}

export async function runUdpServer(): Promise<void> {
  const handle = await createUdpEchoServer();
  log.info(`pid=${process.pid} ready (Ctrl+C to stop)`);

  let shuttingDown = false;
  const onSignal = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      log.info(`${signal} again — forcing exit`);
      process.exit(1);
    }
    shuttingDown = true;
    log.info(`${signal} received — closing udp socket`);
    handle.close().then(() => log.info("shutdown complete"));
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  await new Promise<void>((resolve) => handle.socket.once("close", resolve));
}
