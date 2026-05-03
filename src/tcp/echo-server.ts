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

  const server = net.createServer((socket) => {
    log.debug(`connection from ${socket.remoteAddress}:${socket.remotePort}`);

    socket.on("data", (chunk) => {
      // Buffer를 그대로 echo. 인코딩 변환을 안 해야 binary safe하다.
      socket.write(chunk);
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
        close: () =>
          new Promise<void>((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          }),
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
