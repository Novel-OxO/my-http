import { HttpRequestParser } from "./parser";
import { log } from "../tcp/log";

/**
 * stdin으로 raw HTTP 요청 byte를 받아 파싱 결과를 JSON으로 출력하는 학습용 데모.
 *
 * 사용 예:
 *   printf 'GET / HTTP/1.1\r\nHost: a\r\n\r\n' | pnpm start http-parse
 *   curl -v http://example.com 2>&1 (의 요청 부분을 손으로 복사) → 입력
 */
export async function runHttpParseDemo(): Promise<void> {
  const parser = new HttpRequestParser();
  const chunks: Buffer[] = [];

  process.stdin.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
    try {
      parser.feed(chunk);
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
    }
    drain(parser);
  });

  process.stdin.on("end", () => {
    drain(parser);
    log.info(`total bytes consumed: ${Buffer.concat(chunks).length}`);
    process.exit(0);
  });

  log.info("waiting for HTTP request bytes on stdin (Ctrl+D to end)");
}

function drain(parser: HttpRequestParser): void {
  while (true) {
    const msg = parser.next();
    if (!msg) return;
    process.stdout.write(
      JSON.stringify(
        {
          method: msg.method,
          target: msg.target,
          httpVersion: msg.httpVersion,
          headers: msg.headers,
          bodyBytes: msg.body.length,
          bodyPreview: msg.body.subarray(0, 64).toString("utf8"),
          trailers: msg.trailers,
        },
        null,
        2,
      ) + "\n",
    );
  }
}
