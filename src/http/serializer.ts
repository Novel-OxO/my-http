import { HttpParseError } from "./errors";
import { isToken } from "./grammar";
import {
  getAllHeaders,
  getHeader,
  type HttpHeaderEntry,
  type HttpHeaders,
  type HttpRequest,
  type HttpResponse,
} from "./types";

/**
 * 학습 포인트:
 * - 직렬화는 파싱과 거울이어야 한다 — round-trip이 동치여야 학습이 검증된다.
 * - Content-Length 자동 계산 / chunked 모드 옵션 / 사용자가 이미 설정한 헤더 존중.
 * - 헤더 name 토큰 검증과 value의 CR/LF/NUL 검증을 직렬화에서도 수행 (보안).
 */

const CRLF = "\r\n";

export interface SerializeOptions {
  /** true면 Transfer-Encoding: chunked로 body를 인코딩한다. Content-Length는 추가하지 않음. */
  chunked?: boolean;
}

function validateAndCleanHeaders(headers: HttpHeaders): HttpHeaderEntry[] {
  const out: HttpHeaderEntry[] = [];
  for (const [n, v] of headers) {
    if (!isToken(n)) {
      throw new HttpParseError(500, `invalid header name on serialize: ${JSON.stringify(n)}`);
    }
    for (let i = 0; i < v.length; i++) {
      const c = v.charCodeAt(i);
      if (c === 0x00 || c === 0x0a || c === 0x0d) {
        throw new HttpParseError(500, `invalid byte in header value: ${JSON.stringify(n)}`);
      }
    }
    out.push([n, v]);
  }
  return out;
}

function buildHeaderSection(headers: readonly HttpHeaderEntry[]): string {
  return headers.map(([n, v]) => `${n}: ${v}`).join(CRLF);
}

function withFramingHeaders(
  headers: readonly HttpHeaderEntry[],
  body: Buffer,
  chunked: boolean,
): HttpHeaderEntry[] {
  const hasCL = getHeader(headers, "content-length") !== undefined;
  const hasTE = getAllHeaders(headers, "transfer-encoding").length > 0;

  if (chunked) {
    if (hasCL || hasTE) {
      throw new HttpParseError(
        500,
        "do not set Content-Length/Transfer-Encoding when chunked option is used",
      );
    }
    return [...headers, ["Transfer-Encoding", "chunked"]];
  }

  if (hasCL || hasTE) return [...headers]; // 사용자가 직접 설정함 — 존중
  return [...headers, ["Content-Length", String(body.length)]];
}

function encodeChunked(body: Buffer): Buffer {
  const parts: Buffer[] = [];
  if (body.length > 0) {
    parts.push(Buffer.from(body.length.toString(16) + CRLF));
    parts.push(body);
    parts.push(Buffer.from(CRLF));
  }
  parts.push(Buffer.from("0" + CRLF + CRLF));
  return Buffer.concat(parts);
}

export function serializeRequest(req: HttpRequest, opts: SerializeOptions = {}): Buffer {
  if (!isToken(req.method)) {
    throw new HttpParseError(500, `invalid method: ${JSON.stringify(req.method)}`);
  }
  const headers = withFramingHeaders(
    validateAndCleanHeaders(req.headers),
    req.body,
    !!opts.chunked,
  );
  const startLine = `${req.method} ${req.target} ${req.httpVersion}`;
  const headerSection = buildHeaderSection(headers);
  const head = Buffer.from(startLine + CRLF + headerSection + CRLF + CRLF);
  const body = opts.chunked ? encodeChunked(req.body) : req.body;
  return Buffer.concat([head, body]);
}

export function serializeResponse(res: HttpResponse, opts: SerializeOptions = {}): Buffer {
  if (!Number.isInteger(res.statusCode) || res.statusCode < 100 || res.statusCode > 599) {
    throw new HttpParseError(500, `invalid status code: ${res.statusCode}`);
  }
  const headers = withFramingHeaders(
    validateAndCleanHeaders(res.headers),
    res.body,
    !!opts.chunked,
  );
  const startLine =
    res.reasonPhrase.length > 0
      ? `${res.httpVersion} ${res.statusCode} ${res.reasonPhrase}`
      : `${res.httpVersion} ${res.statusCode} `;
  const headerSection = buildHeaderSection(headers);
  const head = Buffer.from(startLine + CRLF + headerSection + CRLF + CRLF);
  const body = opts.chunked ? encodeChunked(res.body) : res.body;
  return Buffer.concat([head, body]);
}
