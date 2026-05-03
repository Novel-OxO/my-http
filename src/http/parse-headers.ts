import { HttpParseError } from "./errors";
import { isToken, trimOWS } from "./grammar";
import type { HttpHeaderEntry, HttpHeaders } from "./types";

/**
 * RFC 9112 §5 — header field = field-name ":" OWS field-value OWS CRLF
 *
 * 학습 포인트:
 * - field-name은 토큰. 콜론 앞 공백 금지(이전 spec에서 허용했지만 9112에서 reject).
 * - field-value는 OWS만 trim. 내부 공백/탭 보존.
 * - 같은 name이 여러 줄 등장하면 그대로 list에 둔다 (콤마 합치기를 강제하지 않음 —
 *   상위에서 의미에 맞게 처리하라는 의미. Set-Cookie 같은 건 합치면 안 됨).
 * - obs-fold(헤더 줄 이어쓰기, leading SP/HTAB)는 RFC 9112에서 obsolete — reject.
 */

export const DEFAULT_MAX_HEADER_BYTES = 8 * 1024;

export interface ParseHeadersOptions {
  /** header 영역 누적 byte 한도. 기본 8KB. */
  maxBytes?: number;
}

export function parseHeaderLines(
  lines: readonly string[],
  options: ParseHeadersOptions = {},
): HttpHeaders {
  const max = options.maxBytes ?? DEFAULT_MAX_HEADER_BYTES;
  let total = 0;
  for (const l of lines) total += l.length + 2; // +CRLF
  if (total > max) {
    throw new HttpParseError(431, `header section exceeds ${max} bytes`);
  }

  const headers: HttpHeaderEntry[] = [];
  for (const line of lines) {
    if (line.length === 0) {
      throw new HttpParseError(400, "empty header line");
    }

    // obs-fold: 줄이 SP/HTAB로 시작하면 거부 (이전 줄에 이어붙는 옛 형식)
    const first = line.charCodeAt(0);
    if (first === 0x20 || first === 0x09) {
      throw new HttpParseError(400, "obs-fold (line folding) is not allowed");
    }

    const colon = line.indexOf(":");
    if (colon < 0) {
      throw new HttpParseError(400, `missing colon in header: ${JSON.stringify(line)}`);
    }
    const name = line.slice(0, colon);
    if (!isToken(name)) {
      throw new HttpParseError(400, `invalid header name: ${JSON.stringify(name)}`);
    }
    // RFC 9112 §5.1: name과 ":" 사이 공백은 reject
    // (name은 token이라 공백을 포함할 수 없으니 isToken에서 이미 reject됨)

    const rawValue = line.slice(colon + 1);
    const value = trimOWS(rawValue);
    // value 안에 CTL(특히 NUL, CR, LF)이 들어오면 안 된다
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      if (c === 0x00 || c === 0x0a || c === 0x0d) {
        throw new HttpParseError(400, "invalid byte in header value");
      }
    }

    headers.push([name, value]);
  }

  return headers;
}
