import * as net from "node:net";
import { log } from "./log";

/**
 * Backpressure 학습용 데모.
 *
 * 서버는 클라이언트가 접속하면 50MB짜리 buffer를 잘게 쪼개 빠르게 write 한다.
 * - "올바른" 경로: socket.write()가 false를 반환하면 'drain' 이벤트까지 추가 write를 멈춘다.
 * - "잘못된" 경로(WAIT_DRAIN=false): 반환값을 무시하고 계속 write — Node 내부 큐에
 *   버퍼가 쌓여 process.memoryUsage().heapUsed 가 폭증한다.
 *
 * `WAIT_DRAIN` 환경변수로 두 경로를 비교한다.
 *
 *   pnpm start backpressure                          # WAIT_DRAIN=true (기본, 안전)
 *   WAIT_DRAIN=false pnpm start backpressure         # 메모리 폭증 관찰
 */

const TOTAL_BYTES = 50 * 1024 * 1024;
const CHUNK_SIZE = 64 * 1024;

function fmtMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1) + "MB";
}

export async function runBackpressureDemo(): Promise<void> {
  const waitDrain = (process.env.WAIT_DRAIN ?? "true").toLowerCase() !== "false";
  log.info(`backpressure demo: WAIT_DRAIN=${waitDrain}`);

  const server = net.createServer(async (socket) => {
    const chunk = Buffer.alloc(CHUNK_SIZE, "x");
    let written = 0;
    let drainWaits = 0;
    const startMem = process.memoryUsage().heapUsed;

    while (written < TOTAL_BYTES) {
      const ok = socket.write(chunk);
      written += chunk.length;
      if (!ok) {
        if (waitDrain) {
          drainWaits += 1;
          await new Promise<void>((res) => socket.once("drain", res));
        }
        // waitDrain=false: 그냥 계속 진행. 내부 buffer가 쌓인다.
      }
    }

    const endMem = process.memoryUsage().heapUsed;
    log.info(
      `wrote=${fmtMB(written)} drainWaits=${drainWaits} ` +
        `heapDelta=${fmtMB(endMem - startMem)}`,
    );
    socket.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no address");
  log.info(`demo server on ${address.address}:${address.port}`);

  // 자체적으로 클라이언트도 띄워서 데이터를 천천히 읽도록 한다.
  // 일부러 setTimeout으로 소비 속도를 늦춰 송신 측에서 backpressure가 생기게 만든다.
  const client = net.createConnection({ port: address.port, host: address.address });
  let received = 0;
  client.on("data", (data: Buffer) => {
    received += data.length;
    client.pause();
    setTimeout(() => client.resume(), 5); // 느린 소비자 시뮬
  });
  await new Promise<void>((resolve) => client.once("close", () => resolve()));
  log.info(`client received=${fmtMB(received)}`);

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}
