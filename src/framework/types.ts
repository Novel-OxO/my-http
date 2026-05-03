import type { HttpHeaders, HttpRequest, HttpVersion } from "../http/types";

export interface FwRequest {
  method: string;
  target: string;
  httpVersion: HttpVersion;
  headers: HttpHeaders;
  /** 기본 raw Buffer. body parser 미들웨어가 디코드한 값으로 대체할 수 있다. */
  body: unknown;
  rawBody: Buffer;
  params: Record<string, string>;
  query: Record<string, string>;
  /** request-target을 path/query로 분해한 결과. */
  url: { path: string; query: string };
  /** 원본 HTTP 메시지 객체 (필요 시 접근). */
  raw: HttpRequest;
}

export type NextFn = (err?: unknown) => void;
export type Handler = (
  req: FwRequest,
  res: ResponseBuilder,
  next: NextFn,
) => void | Promise<void>;
export type ErrorHandler = (
  err: unknown,
  req: FwRequest,
  res: ResponseBuilder,
) => void | Promise<void>;

export interface ResponseBuilder {
  status(code: number): this;
  set(name: string, value: string): this;
  json(value: unknown): void;
  text(value: string): void;
  send(body: Buffer | string): void;
  end(): void;
  /** 응답이 이미 보내졌는지. */
  readonly headersSent: boolean;
}
