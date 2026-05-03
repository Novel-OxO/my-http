/**
 * 파싱 에러.
 *
 * 권장 status code를 함께 가져 서버 레이어가 4xx/5xx 매핑에 활용한다.
 * RFC 9112 §6.1 등에서 규정한 케이스를 명시한다.
 */
export class HttpParseError extends Error {
  readonly status: number;
  readonly detail?: string;

  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.name = "HttpParseError";
    this.status = status;
    this.detail = detail;
  }
}
