/**
 * HTTP/1.1 메시지 타입.
 *
 * 학습 포인트:
 * - 헤더는 multi-value가 가능하고 입력 순서가 의미 있을 수 있어 Map 대신 list로
 *   보존한다. 콤마 분리 값(field-value with commas)도 한 entry로 그대로 둔다.
 * - body는 항상 Buffer. 디코딩(텍스트/JSON 등)은 상위 레이어에서.
 */

export type HttpVersion = "HTTP/1.0" | "HTTP/1.1";

export type HttpHeaderEntry = readonly [name: string, value: string];
export type HttpHeaders = ReadonlyArray<HttpHeaderEntry>;

export interface HttpRequest {
  method: string;
  target: string;
  httpVersion: HttpVersion;
  headers: HttpHeaders;
  body: Buffer;
  trailers?: HttpHeaders;
}

export interface HttpResponse {
  httpVersion: HttpVersion;
  statusCode: number;
  reasonPhrase: string;
  headers: HttpHeaders;
  body: Buffer;
  trailers?: HttpHeaders;
}

/** 케이스 무시 단일 lookup. 첫 매치 반환. */
export function getHeader(
  headers: HttpHeaders,
  name: string,
): string | undefined {
  const lower = name.toLowerCase();
  for (const [n, v] of headers) {
    if (n.toLowerCase() === lower) return v;
  }
  return undefined;
}

/** 케이스 무시 multi-value lookup. 같은 이름의 모든 값을 순서대로 반환. */
export function getAllHeaders(
  headers: HttpHeaders,
  name: string,
): string[] {
  const lower = name.toLowerCase();
  const out: string[] = [];
  for (const [n, v] of headers) {
    if (n.toLowerCase() === lower) out.push(v);
  }
  return out;
}
