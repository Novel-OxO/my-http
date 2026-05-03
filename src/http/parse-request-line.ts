import { HttpParseError } from "./errors";
import { isToken } from "./grammar";
import type { HttpVersion } from "./types";

/**
 * RFC 9112 §3 — request-line = method SP request-target SP HTTP-version CRLF
 *
 * 학습 포인트:
 * - 정확히 SP 하나로 구분. tab/여러 공백 금지.
 * - method는 토큰 규칙(대소문자 보존). target은 임의 byte이지만 SP/CTL 금지.
 * - version은 HTTP/1.0 또는 HTTP/1.1만 받는다 (HTTP/0.9는 505).
 */
export interface RequestLine {
  method: string;
  target: string;
  httpVersion: HttpVersion;
}

export function parseRequestLine(line: string): RequestLine {
  // 빈 줄 / CRLF 잔여물 방지
  if (line.length === 0) {
    throw new HttpParseError(400, "empty request line");
  }

  // SP 하나로 정확히 split. split(' ', 3)이 아니라 직접 인덱싱.
  const firstSp = line.indexOf(" ");
  if (firstSp <= 0) {
    throw new HttpParseError(400, "missing SP after method");
  }
  const secondSp = line.indexOf(" ", firstSp + 1);
  if (secondSp < 0) {
    throw new HttpParseError(400, "missing SP after target");
  }
  // 이후에 또 공백이 있으면 잘못된 형식
  if (line.indexOf(" ", secondSp + 1) >= 0) {
    throw new HttpParseError(400, "extra whitespace in request line");
  }

  const method = line.slice(0, firstSp);
  const target = line.slice(firstSp + 1, secondSp);
  const versionRaw = line.slice(secondSp + 1);

  if (!isToken(method)) {
    throw new HttpParseError(400, `invalid method: ${JSON.stringify(method)}`);
  }
  if (target.length === 0) {
    throw new HttpParseError(400, "empty request target");
  }
  // target에 CTL/SPACE가 들어오면 위 split에서 이미 걸러지지만,
  // tab 같은 다른 공백은 따로 막는다.
  for (let i = 0; i < target.length; i++) {
    const c = target.charCodeAt(i);
    if (c < 0x21 || c === 0x7f) {
      throw new HttpParseError(400, "invalid byte in request target");
    }
  }

  const httpVersion = parseHttpVersion(versionRaw);
  return { method, target, httpVersion };
}

export function parseHttpVersion(raw: string): HttpVersion {
  if (raw === "HTTP/1.1" || raw === "HTTP/1.0") return raw;
  if (raw === "HTTP/0.9") {
    throw new HttpParseError(505, `unsupported HTTP version: ${raw}`);
  }
  if (!/^HTTP\/\d+\.\d+$/.test(raw)) {
    throw new HttpParseError(400, `malformed HTTP version: ${JSON.stringify(raw)}`);
  }
  throw new HttpParseError(505, `unsupported HTTP version: ${raw}`);
}
