import { serializeResponse } from "../http/serializer";
import { getHeader, type HttpHeaderEntry } from "../http/types";
import type { ResponseBuilder } from "./types";

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "Created",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  413: "Content Too Large",
  415: "Unsupported Media Type",
  431: "Request Header Fields Too Large",
  500: "Internal Server Error",
  501: "Not Implemented",
  505: "HTTP Version Not Supported",
};

export interface ResponseSink {
  send(buf: Buffer): void;
  /** keep-alive 결정용: false면 응답 후 close. */
  shouldKeepAlive: boolean;
}

export class HttpResponseBuilder implements ResponseBuilder {
  private statusCode = 200;
  private readonly headers: HttpHeaderEntry[] = [];
  private sent = false;

  constructor(private readonly sink: ResponseSink) {}

  get headersSent(): boolean {
    return this.sent;
  }

  status(code: number): this {
    if (this.sent) throw new Error("status() called after response sent");
    this.statusCode = code;
    return this;
  }

  set(name: string, value: string): this {
    if (this.sent) throw new Error("set() called after response sent");
    this.headers.push([name, value]);
    return this;
  }

  json(value: unknown): void {
    const body = Buffer.from(JSON.stringify(value));
    this.ensureContentType("application/json; charset=utf-8");
    this.send(body);
  }

  text(value: string): void {
    this.ensureContentType("text/plain; charset=utf-8");
    this.send(Buffer.from(value, "utf8"));
  }

  send(body: Buffer | string): void {
    const buf = typeof body === "string" ? Buffer.from(body, "utf8") : body;
    this.ensureContentType("application/octet-stream");
    this.flush(buf);
  }

  end(): void {
    this.flush(Buffer.alloc(0));
  }

  private ensureContentType(defaultValue: string): void {
    if (getHeader(this.headers, "content-type") === undefined) {
      this.headers.push(["Content-Type", defaultValue]);
    }
  }

  private flush(body: Buffer): void {
    if (this.sent) throw new Error("response already sent");
    this.sent = true;
    if (!this.sink.shouldKeepAlive && getHeader(this.headers, "connection") === undefined) {
      this.headers.push(["Connection", "close"]);
    } else if (this.sink.shouldKeepAlive && getHeader(this.headers, "connection") === undefined) {
      this.headers.push(["Connection", "keep-alive"]);
    }
    const buf = serializeResponse({
      httpVersion: "HTTP/1.1",
      statusCode: this.statusCode,
      reasonPhrase: STATUS_TEXT[this.statusCode] ?? "",
      headers: this.headers,
      body,
    });
    this.sink.send(buf);
  }
}
