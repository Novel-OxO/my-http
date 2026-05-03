# Spec 03. HTTP/1.1 파서와 직렬화

## 1. 목표

RFC 9112 §2~§7을 기준으로 raw byte → `HttpRequest`/`HttpResponse` 객체와 그 역방향(직렬화)을 직접 구현한다. 외부 파서 라이브러리 사용 금지. 학습 우선이라 정확성과 edge case 처리가 핵심이고, 성능 최적화는 검증 이후에만 한다.

## 2. 비목표

- HTTP/2, HTTP/3
- TLS / 압축 콘텐츠
- 멀티파트 디코딩 (헤더만 인식, body는 raw bytes)
- 캐시 의미론, redirect 처리
- 상위 프레임워크 (Phase 3)

## 3. 범위

1. **Request line / Response status line 파싱** (`src/http/parse-request-line.ts`, `parse-status-line.ts`)
2. **Header 파싱** (`src/http/parse-headers.ts`) — case-insensitive, multi-value, OWS, 확장된 RFC 9110 token 검증
3. **Body 파싱**
   - `Content-Length` 기반 (정확히 N byte 수집)
   - `Transfer-Encoding: chunked` (size line(hex) + CRLF + data + CRLF, 0 종결, trailer 인식 후 무시)
4. **Incremental 상태머신** (`src/http/parser.ts`) — `feed(chunk: Buffer)` + `next(): HttpRequest | null`. 1 byte씩 흘려도 동일한 결과.
5. **Response 파싱** — request와 동일 골격에 status line만 다른 변형
6. **직렬화** (`src/http/serializer.ts`) — Request/Response 모두. Content-Length 자동 계산, chunked 인코딩 옵션
7. **에러 처리** (`src/http/errors.ts`) — `HttpParseError` + 권장 status code (400/413/431/501 등)
8. **CLI 데모** (`pnpm start http-parse`) — stdin raw 바이트 → 파싱 결과 JSON 출력

## 4. API

### 4.1 One-shot

```ts
parseRequest(buf: Buffer): HttpRequest;        // 완전한 메시지 가정, 부족/잉여면 throw
parseResponse(buf: Buffer): HttpResponse;
serializeRequest(req: HttpRequest, opts?): Buffer;
serializeResponse(res: HttpResponse, opts?): Buffer;
```

### 4.2 Incremental (스트리밍 친화)

```ts
class HttpRequestParser {
  feed(chunk: Buffer): void;          // 어디서 잘려도 OK
  next(): HttpRequest | null;          // 한 메시지 완성될 때마다 반환 (keep-alive 대비)
  state(): ParserState;                // 디버그/테스트용
  reset(): void;
}
class HttpResponseParser { ... }       // 대칭
```

`next()`가 `null`을 반환하면 더 받아야 한다. 한 chunk에 여러 메시지가 섞여 있어도 (pipelining) 차례대로 빠진다.

## 5. 타입

```ts
type HttpHeaders = ReadonlyArray<[name: string, value: string]>;
// 학습 포인트: 헤더는 multi-value 가능하고 순서가 의미 있을 수 있어
//             Map보다 list로 보존. lookup helper(getHeader, getAllHeaders) 별도 제공.

interface HttpRequest {
  method: string;        // RFC 9110 token. 대소문자 보존(GET/POST 관습은 대문자).
  target: string;        // origin-form 우선 ("/path?query"). absolute-form은 normalize.
  httpVersion: "HTTP/1.0" | "HTTP/1.1";
  headers: HttpHeaders;
  body: Buffer;          // Content-Length 또는 chunked 디코드 결과
  trailers?: HttpHeaders;// chunked의 trailer (있으면)
}

interface HttpResponse {
  httpVersion: "HTTP/1.0" | "HTTP/1.1";
  statusCode: number;    // 100~599
  reasonPhrase: string;  // 빈 문자열 허용 (RFC 9112 §4 OBS)
  headers: HttpHeaders;
  body: Buffer;
  trailers?: HttpHeaders;
}
```

## 6. 상태머신 (incremental)

```
START
  → REQUEST_LINE  (CRLF 만나면 →)
HEADERS
  → 헤더 줄마다 누적, 빈 줄(CRLF) 만나면 BODY 결정
BODY
  Content-Length=N → BODY_LENGTH (N byte 수집 → DONE)
  Transfer-Encoding: chunked → BODY_CHUNK_SIZE → BODY_CHUNK_DATA → ... → BODY_TRAILERS → DONE
  둘 다 없음 → DONE (request는 body 없음으로 간주)
DONE
  → next()가 메시지 반환. 남은 buffer는 다음 메시지의 START로 이월.
```

각 상태는 "현재까지 모인 buffer"를 보고 진행 가능한지 결정한다. 부족하면 그대로 두고 다음 feed를 기다린다.

## 7. 검증 규칙 (RFC 9112 + 9110 발췌)

- Request line: `method SP target SP HTTP-version CRLF`
- Token: `1*tchar` — `!#$%&'*+-.^_`|~ 0-9 A-Z a-z`
- 헤더 line: `field-name ":" OWS field-value OWS CRLF` — name에 공백 금지
- 헤더 multi-value: 동일 name 여러 줄 또는 콤마 구분 모두 허용. parser는 list로 보존.
- 잘못된 byte (예: bare CR, NUL in name) → `HttpParseError`
- Header 영역 8KB 초과 → 431
- Content-Length와 Transfer-Encoding 동시 등장 → 400 (RFC 9112 §6.1)
- Method가 토큰 규칙 위반 → 400
- Version이 HTTP/0.9 → 505 (또는 미지원)

## 8. 에러 처리

```ts
class HttpParseError extends Error {
  status: number;           // 권장 응답 코드
  detail?: string;
}
```

one-shot은 throw. incremental은 동기적으로 throw하면서 parser를 ERROR 상태로 둔다. reset 호출 시에만 복구.

## 9. 테스트 전략

unit 테스트가 메인 (`test/unit/http/`). integration 테스트는 Phase 3에서 한다.

테스트 셋:

- `parse-request-line.test.ts`: 정상, lowercase method, 빈 target, version 누락, 토큰 위반
- `parse-headers.test.ts`: 정상, OWS, 콤마 multi-value, 같은 name 여러 줄, 잘못된 name, 8KB limit
- `body-content-length.test.ts`: 정확히 N, 부족(요청만 있고 body 일부), 초과(추가 데이터는 다음 메시지로 이월)
- `body-chunked.test.ts`: 단순 chunk, 0-size 종결, 여러 chunk, trailer, hex extension(`;name=value`) 인식
- `parser-streaming.test.ts`: 1 byte씩 feed → 동일 결과, chunk 경계 무관성
- `parser-pipelining.test.ts`: 한 buffer에 두 요청 연속 → next() 두 번에 두 메시지
- `parse-response.test.ts`: status line + headers + body
- `serialize-request.test.ts` / `serialize-response.test.ts`: round-trip(파싱→직렬화→파싱) 동치성
- `errors.test.ts`: 위 검증 규칙별 status code

## 10. 승인 기준

- [ ] 모든 unit 테스트 통과
- [ ] 1 byte 단위 streaming feed에서도 정상/에러 결과가 one-shot과 일치
- [ ] keep-alive pipelining 시나리오에서 두 메시지 분리 성공
- [ ] `pnpm start http-parse` 데모로 `curl -v http://...` 의 raw 요청을 파싱해 JSON 출력
- [ ] round-trip 동치성: 파싱한 메시지를 직렬화 → 다시 파싱하면 같은 객체

## 11. 작업 순서

1. spec
2. types + errors + request line 파서
3. header 파서
4. content-length body
5. chunked body
6. incremental 상태머신 (위 4개를 묶음)
7. response 파서
8. 직렬화
9. CLI + README

각 단계마다 unit 테스트를 먼저 통과시키고 commit.
