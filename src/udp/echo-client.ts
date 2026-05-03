import * as dgram from "node:dgram";
import { log } from "../tcp/log";

export type UdpClientOptions = {
  port?: number;
  host?: string;
};

/**
 * UDP는 연결이 없으므로 "client" 개념이 없다. 그냥 자기 소켓에서 send/receive.
 *
 * 학습 포인트 (TCP 대비):
 * - createConnection 같은 connect 단계 없음. bind도 선택적 (send만 할 거면 OS가
 *   임시 포트를 자동 할당).
 * - 응답이 안 와도 정상일 수 있다 (best-effort) → 클라이언트는 timeout이 필수다.
 */
export async function runUdpClient(): Promise<void> {
  const host = process.env.UDP_HOST ?? "127.0.0.1";
  const port = Number(process.env.UDP_PORT ?? 41234);
  const timeoutMs = Number(process.env.UDP_TIMEOUT_MS ?? 2000);

  const socket = dgram.createSocket("udp4");

  socket.on("message", (msg, rinfo) => {
    process.stdout.write(`[${rinfo.address}:${rinfo.port}] ${msg.toString("utf8")}\n`);
  });
  socket.on("error", (err) => log.error(err.message));

  log.info(`udp client → ${host}:${port} (timeout=${timeoutMs}ms, Ctrl+D to exit)`);

  process.stdin.on("data", (chunk) => {
    socket.send(chunk, port, host, (err) => {
      if (err) log.error(`send error: ${err.message}`);
    });
    // 단순 timeout 표시: 메시지마다 timer를 걸어 응답이 없으면 알린다.
    const timer = setTimeout(() => {
      log.info("(no response yet — UDP는 응답 보장이 없음)");
    }, timeoutMs);
    socket.once("message", () => clearTimeout(timer));
  });
  process.stdin.on("end", () => {
    socket.close();
    process.exit(0);
  });
}
