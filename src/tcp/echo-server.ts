import * as net from "node:net";
import { log } from "./log";

export type EchoServerOptions = {
  port?: number;
  host?: string;
};

export type EchoServerHandle = {
  server: net.Server;
  port: number;
  host: string;
  /** 현재 활성화된 클라이언트 소켓 수. */
  activeConnections: () => number;
  /** 새 연결을 거부하고 활성 연결이 모두 끝날 때까지 기다린다 (graceful). */
  close: () => Promise<void>;
};

/**
 * TCP 에코 서버 팩토리.
 *
 * 학습 포인트:
 * - `data` 이벤트는 메시지 경계를 보장하지 않는다. TCP는 byte stream이라
 *   클라이언트가 한 번에 보낸 buffer가 여러 chunk로 쪼개지거나 합쳐져 도착할 수
 *   있다. 여기서는 echo가 전체 합을 보장하기만 하면 되므로 chunk 단위로 그대로
 *   write 한다 (HTTP 파서를 만들 때는 이 가정이 깨진다 — Phase 3에서 다룸).
 */
export function createEchoServer(
  options: EchoServerOptions = {},
): Promise<EchoServerHandle> {
  const host = options.host ?? process.env.HOST ?? "127.0.0.1";
  const port = options.port ?? Number(process.env.PORT ?? 3000);

  /**
   * 활성 소켓 추적. graceful shutdown 시 새 연결은 server.close가 막아주지만
   * 기존 연결은 직접 추적해야 drain까지 기다릴 수 있다.
   */
  const activeSockets = new Set<net.Socket>();

  const server = net.createServer((socket) => {
    activeSockets.add(socket);
    log.debug(
      `connection from ${socket.remoteAddress}:${socket.remotePort} ` +
        `(active=${activeSockets.size})`,
    );

    socket.on("data", (chunk) => {
      // Buffer를 그대로 echo. 인코딩 변환을 안 해야 binary safe하다.
      socket.write(chunk);
    });

    /**
     * `end`는 상대방이 FIN을 보낸 시점 (half-close 가능). 이때는 더 이상 읽을
     * 데이터는 없지만 쓰기는 가능하다. echo 서버에서는 받을 게 없으면 응답할
     * 것도 없으므로 우리도 end를 보낸다.
     */
    socket.on("end", () => {
      log.debug(`socket end ${socket.remoteAddress}:${socket.remotePort}`);
    });

    /**
     * `close`는 양방향 모두 닫힌 최종 시점. hadError === true면 RST/에러로
     * 끊겼다는 뜻이라 정상 종료와 구분된다. 활성 연결 추적은 여기서 정리한다.
     */
    socket.on("close", (hadError) => {
      activeSockets.delete(socket);
      log.debug(
        `socket close hadError=${hadError} ` +
          `(active=${activeSockets.size})`,
      );
    });

    socket.on("error", (err) => {
      log.debug(`socket error: ${err.message}`);
    });
  });

  return new Promise<EchoServerHandle>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("unexpected server address"));
        return;
      }
      log.info(`echo server listening on ${address.address}:${address.port}`);
      resolve({
        server,
        port: address.port,
        host: address.address,
        activeConnections: () => activeSockets.size,
        /**
         * graceful shutdown:
         * 1) server.close() — 새 연결은 더 이상 받지 않는다 (listening 해제).
         * 2) 활성 소켓은 자연 종료를 기다린다 (drain).
         * 3) 모든 소켓이 닫히면 server는 'close' 이벤트를 발생시킨다.
         */
        close: async () => {
          const serverClosed = new Promise<void>((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          });
          for (const socket of activeSockets) {
            socket.end();
          }
          await serverClosed;
          // server.close 콜백은 내부 카운터 기준으로 먼저 fire될 수 있다.
          // activeSockets이 실제로 비워질 때까지 추가로 기다린다.
          while (activeSockets.size > 0) {
            await new Promise<void>((res) => setImmediate(res));
          }
        },
      });
    });
  });
}

export async function runServer(): Promise<void> {
  const handle = await createEchoServer();
  log.info(`pid=${process.pid} ready (Ctrl+C to stop)`);
  // 프로세스가 살아있도록 server가 close될 때까지 기다린다.
  await new Promise<void>((resolve) => handle.server.once("close", resolve));
}
