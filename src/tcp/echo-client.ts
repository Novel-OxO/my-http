import * as net from "node:net";
import { log } from "./log";

export type EchoClientOptions = {
  port?: number;
  host?: string;
};

/**
 * stdin → 서버, 서버 → stdout 양방향 파이프 형태의 단순 echo 클라이언트.
 *
 * 학습 포인트:
 * - `setEncoding('utf8')`을 켜면 'data' chunk가 Buffer 대신 string으로 들어온다.
 *   사람이 읽기엔 편하지만 multi-byte 문자가 chunk 경계를 가로지르면 깨질 수 있고,
 *   binary safety를 잃는다. 여기서는 stdout으로 사람이 보는 용도라 켜둔다.
 *   서버 echo는 일부러 Buffer 그대로 다뤘다 — 두 코드의 차이를 비교하는 게 학습 포인트다.
 */
export async function createEchoClient(
  options: EchoClientOptions = {},
): Promise<net.Socket> {
  const host = options.host ?? process.env.HOST ?? "127.0.0.1";
  const port = options.port ?? Number(process.env.PORT ?? 3000);

  return new Promise<net.Socket>((resolve, reject) => {
    const socket = net.createConnection({ port, host });
    socket.once("connect", () => {
      log.info(`connected to ${host}:${port}`);
      resolve(socket);
    });
    socket.once("error", reject);
  });
}

export async function runClient(): Promise<void> {
  const socket = await createEchoClient();

  // string 모드. 학습 포인트 주석은 createEchoClient 위에 있다.
  socket.setEncoding("utf8");

  socket.on("data", (chunk: string | Buffer) => {
    process.stdout.write(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
  });

  socket.on("end", () => log.info("server closed connection"));
  socket.on("close", (hadError) => {
    log.info(`socket closed hadError=${hadError}`);
    process.exit(hadError ? 1 : 0);
  });
  socket.on("error", (err) => log.error(err.message));

  // stdin → socket. 줄바꿈 단위로 끊지 않고 raw로 흘려보낸다.
  process.stdin.on("data", (chunk) => socket.write(chunk));
  process.stdin.on("end", () => socket.end());
}
