import { HttpParseError } from "./errors";
import { CR, LF } from "./grammar";
import { parseHeaderLines, DEFAULT_MAX_HEADER_BYTES } from "./parse-headers";
import { parseRequestLine } from "./parse-request-line";
import { parseStatusLine } from "./parse-status-line";
import {
  getAllHeaders,
  getHeader,
  type HttpHeaders,
  type HttpRequest,
  type HttpResponse,
  type HttpVersion,
} from "./types";

/**
 * Incremental HTTP/1.1 파서 (Request).
 *
 * 학습 포인트:
 * - 네트워크에서 메시지가 한 번에 들어온다는 보장이 없다 (TCP는 byte stream).
 *   feed(chunk)에 어떤 byte boundary가 와도 동일 결과를 내야 한다.
 * - keep-alive/pipelining: 한 buffer에 여러 메시지가 연속될 수 있다 →
 *   next()를 반복 호출하면 차례로 빠진다.
 * - Content-Length와 Transfer-Encoding이 동시 등장 → 400 (RFC 9112 §6.1)
 *   (request smuggling 예방).
 */

export type ParserState =
  | "START"
  | "HEADERS"
  | "BODY_LENGTH"
  | "BODY_CHUNK_SIZE"
  | "BODY_CHUNK_DATA"
  | "BODY_CHUNK_TRAILERS"
  | "DONE"
  | "ERROR";

interface ParseInProgress {
  startLine?: { kind: "request"; method: string; target: string; version: HttpVersion }
    | { kind: "response"; version: HttpVersion; statusCode: number; reasonPhrase: string };
  /** HEADERS 상태에서 누적되는 raw 라인. streaming 시 advance() 호출 사이에 보관 필수. */
  headerLines: string[];
  headerLinesBytes: number;
  headers?: HttpHeaders;
  /** chunked의 trailer 누적용. */
  trailerLines: string[];
  bodyChunks: Buffer[];
  bodyReceived: number;
  bodyExpected?: number; // Content-Length 모드
  // chunked 모드 임시 상태
  currentChunkSize?: number;
  currentChunkRead?: number;
  trailers?: HttpHeaders;
}

const MAX_LINE_BYTES = 8 * 1024;

abstract class HttpMessageParser<T> {
  protected buffer: Buffer = Buffer.alloc(0);
  protected stateName: ParserState = "START";
  protected current: ParseInProgress = emptyProgress();
  protected ready: T[] = [];
  protected lastError: HttpParseError | null = null;

  state(): ParserState {
    return this.stateName;
  }

  reset(): void {
    this.buffer = Buffer.alloc(0);
    this.stateName = "START";
    this.current = emptyProgress();
    this.ready = [];
    this.lastError = null;
  }

  feed(chunk: Buffer): void {
    if (this.stateName === "ERROR") {
      throw this.lastError ?? new HttpParseError(400, "parser is in error state");
    }
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
    this.advance();
  }

  next(): T | null {
    return this.ready.shift() ?? null;
  }

  protected abstract parseStartLineString(line: string): NonNullable<ParseInProgress["startLine"]>;

  protected abstract assemble(p: ParseInProgress): T;

  /** 더 이상 진행 불가능할 때까지 상태를 진행시킨다. */
  private advance(): void {
    while (true) {
      switch (this.stateName) {
        case "START": {
          // request line이 들어올 때까지는 leading CRLF를 허용 (관용)
          while (this.buffer.length > 0 && (this.buffer[0] === CR || this.buffer[0] === LF)) {
            this.buffer = this.buffer.subarray(1);
          }
          const line = this.takeLine();
          if (line === null) return;
          try {
            this.current.startLine = this.parseStartLineString(line);
          } catch (err) {
            return this.fail(err);
          }
          this.stateName = "HEADERS";
          break;
        }
        case "HEADERS": {
          while (true) {
            const line = this.peekLine();
            if (line === null) return; // 더 받기
            if (line.length === 0) {
              this.consumePeekedLine();
              try {
                this.current.headers = parseHeaderLines(this.current.headerLines);
              } catch (err) {
                return this.fail(err);
              }
              this.stateName = this.decideBodyMode();
              break;
            }
            this.current.headerLinesBytes += line.length + 2;
            if (this.current.headerLinesBytes > DEFAULT_MAX_HEADER_BYTES) {
              return this.fail(new HttpParseError(431, "header section too large"));
            }
            this.current.headerLines.push(line);
            this.consumePeekedLine();
          }
          break;
        }
        case "BODY_LENGTH": {
          const need = (this.current.bodyExpected ?? 0) - this.current.bodyReceived;
          if (need <= 0) {
            this.finishMessage();
            break;
          }
          if (this.buffer.length === 0) return;
          const take = Math.min(need, this.buffer.length);
          this.current.bodyChunks.push(this.buffer.subarray(0, take));
          this.current.bodyReceived += take;
          this.buffer = this.buffer.subarray(take);
          if (this.current.bodyReceived === this.current.bodyExpected) {
            this.finishMessage();
          }
          break;
        }
        case "BODY_CHUNK_SIZE": {
          const line = this.takeLine();
          if (line === null) return;
          const sizeStr = line.split(";")[0]; // chunk extension 무시
          if (!/^[0-9a-fA-F]+$/.test(sizeStr)) {
            return this.fail(new HttpParseError(400, `invalid chunk size: ${sizeStr}`));
          }
          const size = parseInt(sizeStr, 16);
          this.current.currentChunkSize = size;
          this.current.currentChunkRead = 0;
          if (size === 0) {
            this.stateName = "BODY_CHUNK_TRAILERS";
          } else {
            this.stateName = "BODY_CHUNK_DATA";
          }
          break;
        }
        case "BODY_CHUNK_DATA": {
          const remaining =
            (this.current.currentChunkSize ?? 0) - (this.current.currentChunkRead ?? 0);
          if (remaining > 0) {
            if (this.buffer.length === 0) return;
            const take = Math.min(remaining, this.buffer.length);
            this.current.bodyChunks.push(this.buffer.subarray(0, take));
            this.current.currentChunkRead = (this.current.currentChunkRead ?? 0) + take;
            this.current.bodyReceived += take;
            this.buffer = this.buffer.subarray(take);
            if ((this.current.currentChunkRead ?? 0) < (this.current.currentChunkSize ?? 0)) return;
          }
          // chunk 뒤 CRLF 소비
          if (this.buffer.length < 2) return;
          if (this.buffer[0] !== CR || this.buffer[1] !== LF) {
            return this.fail(new HttpParseError(400, "missing CRLF after chunk data"));
          }
          this.buffer = this.buffer.subarray(2);
          this.stateName = "BODY_CHUNK_SIZE";
          break;
        }
        case "BODY_CHUNK_TRAILERS": {
          // size 0 chunk 뒤. trailer header가 0개 이상 뒤이어 빈 줄로 끝남.
          while (true) {
            const line = this.peekLine();
            if (line === null) return;
            if (line.length === 0) {
              this.consumePeekedLine();
              try {
                this.current.trailers = parseHeaderLines(this.current.trailerLines);
              } catch (err) {
                return this.fail(err);
              }
              this.finishMessage();
              break;
            }
            this.current.trailerLines.push(line);
            this.consumePeekedLine();
          }
          break;
        }
        case "DONE": {
          // 다음 메시지를 위해 START로 (keep-alive/pipelining)
          this.stateName = "START";
          this.current = emptyProgress();
          if (this.buffer.length === 0) return;
          break;
        }
        case "ERROR":
          return;
      }
    }
  }

  private decideBodyMode(): ParserState {
    const headers = this.current.headers ?? [];
    const teValues = getAllHeaders(headers, "transfer-encoding");
    const cl = getHeader(headers, "content-length");

    if (teValues.length > 0 && cl !== undefined) {
      this.fail(
        new HttpParseError(
          400,
          "both Transfer-Encoding and Content-Length present",
        ),
      );
      return "ERROR";
    }

    if (teValues.length > 0) {
      // 마지막 transfer-encoding이 chunked여야 함 (RFC 9112 §6.1)
      const joined = teValues
        .flatMap((v) => v.split(",").map((s) => s.trim().toLowerCase()))
        .filter(Boolean);
      const last = joined[joined.length - 1];
      if (last !== "chunked") {
        this.fail(new HttpParseError(400, `unsupported transfer-encoding chain: ${joined.join(",")}`));
        return "ERROR";
      }
      return "BODY_CHUNK_SIZE";
    }

    if (cl !== undefined) {
      if (!/^\d+$/.test(cl)) {
        this.fail(new HttpParseError(400, `invalid Content-Length: ${cl}`));
        return "ERROR";
      }
      const n = Number(cl);
      if (!Number.isFinite(n) || n < 0) {
        this.fail(new HttpParseError(400, "invalid Content-Length"));
        return "ERROR";
      }
      this.current.bodyExpected = n;
      if (n === 0) {
        // 즉시 DONE 처리
        this.finishMessage();
        return this.stateName; // finishMessage가 상태를 바꿈
      }
      return "BODY_LENGTH";
    }

    // 둘 다 없음: request는 body 없음, response는 호출자가 close까지 읽기 책임이지만
    // 여기서는 body 없음으로 간주 (학습 단순화).
    this.finishMessage();
    return this.stateName;
  }

  private finishMessage(): void {
    const message = this.assemble(this.current);
    this.ready.push(message);
    this.current = emptyProgress();
    this.stateName = "DONE";
  }

  private fail(err: unknown): void {
    const e =
      err instanceof HttpParseError
        ? err
        : new HttpParseError(400, err instanceof Error ? err.message : String(err));
    this.lastError = e;
    this.stateName = "ERROR";
    throw e;
  }

  /** 다음 CRLF 까지의 라인을 꺼낸다. CRLF는 소비. 라인 미완이면 null. */
  private takeLine(): string | null {
    const line = this.peekLine();
    if (line === null) return null;
    this.consumePeekedLine();
    return line;
  }

  private peekedEnd: number | null = null;
  private peekedLine: string | null = null;
  private peekLine(): string | null {
    if (this.peekedLine !== null) return this.peekedLine;
    const idx = this.buffer.indexOf(CR);
    if (idx < 0) {
      if (this.buffer.length > MAX_LINE_BYTES) {
        return this.failLine();
      }
      return null;
    }
    if (idx + 1 >= this.buffer.length) return null; // CR만 있고 LF 미도착
    if (this.buffer[idx + 1] !== LF) {
      // bare CR
      this.fail(new HttpParseError(400, "bare CR not allowed"));
      return null;
    }
    if (idx > MAX_LINE_BYTES) {
      return this.failLine();
    }
    this.peekedLine = this.buffer.subarray(0, idx).toString("latin1");
    this.peekedEnd = idx + 2;
    return this.peekedLine;
  }
  private consumePeekedLine(): void {
    if (this.peekedEnd === null) return;
    this.buffer = this.buffer.subarray(this.peekedEnd);
    this.peekedLine = null;
    this.peekedEnd = null;
  }
  private failLine(): null {
    this.fail(new HttpParseError(431, "line too long"));
    return null;
  }
}

function emptyProgress(): ParseInProgress {
  return {
    headerLines: [],
    headerLinesBytes: 0,
    trailerLines: [],
    bodyChunks: [],
    bodyReceived: 0,
  };
}

export class HttpRequestParser extends HttpMessageParser<HttpRequest> {
  protected parseStartLineString(line: string) {
    const r = parseRequestLine(line);
    return {
      kind: "request" as const,
      method: r.method,
      target: r.target,
      version: r.httpVersion,
    };
  }
  protected assemble(p: ParseInProgress): HttpRequest {
    if (!p.startLine || p.startLine.kind !== "request" || !p.headers) {
      throw new HttpParseError(500, "internal: incomplete request");
    }
    return {
      method: p.startLine.method,
      target: p.startLine.target,
      httpVersion: p.startLine.version,
      headers: p.headers,
      body: Buffer.concat(p.bodyChunks, p.bodyReceived),
      ...(p.trailers ? { trailers: p.trailers } : {}),
    };
  }
}

export class HttpResponseParser extends HttpMessageParser<HttpResponse> {
  protected parseStartLineString(line: string) {
    const s = parseStatusLine(line);
    return {
      kind: "response" as const,
      version: s.httpVersion,
      statusCode: s.statusCode,
      reasonPhrase: s.reasonPhrase,
    };
  }
  protected assemble(p: ParseInProgress): HttpResponse {
    if (!p.startLine || p.startLine.kind !== "response" || !p.headers) {
      throw new HttpParseError(500, "internal: incomplete response");
    }
    return {
      httpVersion: p.startLine.version,
      statusCode: p.startLine.statusCode,
      reasonPhrase: p.startLine.reasonPhrase,
      headers: p.headers,
      body: Buffer.concat(p.bodyChunks, p.bodyReceived),
      ...(p.trailers ? { trailers: p.trailers } : {}),
    };
  }
}

/** One-shot. 완전한 메시지가 buffer에 다 들어있다고 가정. 부족하거나 잉여 byte가 있으면 throw. */
export function parseRequest(buf: Buffer): HttpRequest {
  const p = new HttpRequestParser();
  p.feed(buf);
  const msg = p.next();
  if (!msg) {
    throw new HttpParseError(400, "incomplete request");
  }
  if (p.next() !== null) {
    throw new HttpParseError(400, "trailing data after request");
  }
  return msg;
}

export function parseResponse(buf: Buffer): HttpResponse {
  const p = new HttpResponseParser();
  p.feed(buf);
  const msg = p.next();
  if (!msg) {
    throw new HttpParseError(400, "incomplete response");
  }
  if (p.next() !== null) {
    throw new HttpParseError(400, "trailing data after response");
  }
  return msg;
}
