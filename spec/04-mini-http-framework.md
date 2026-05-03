# Spec 04. 미니 HTTP 프레임워크 (Express-like)

## 1. 목표

Phase 1 (TCP) + Phase 2 (HTTP 파서)를 합쳐서 라우팅·미들웨어·응답 빌더가 있는 Express-like 프레임워크를 직접 만든다. 외부 라이브러리 금지. 학습 우선이라 동작이 맞는 것보다 "왜 이렇게 동작하는가"가 코드 + 통합 테스트로 드러나야 한다.

## 2. 비목표

- 프로덕션 수준 성능 (벤치 후 최적화는 별도)
- HTTPS / HTTP/2
- WebSocket / SSE
- 세션/쿠키 자동 관리, CSRF, CORS 자동화
- DI 컨테이너, 플러그인 시스템

## 3. 범위 (전부 포함)

1. **App / Server** — TCP 소켓 위에 HttpRequestParser를 얹어 요청 단위로 핸들러를 호출
2. **Router** — `app.get/post/put/patch/delete/head/options/use`. path param `/users/:id`. method/path 매칭.
3. **Middleware 체인** — `(req, res, next) => void | Promise<void>`. 동기/비동기 모두. 에러는 `app.onError(handler)`로 흡수.
4. **Response 빌더** — `res.status(n)`, `res.set(name, value)`, `res.json(obj)`, `res.text(s)`, `res.send(buf)`, `res.end()`. content-type 자동 추론.
5. **Body 파서 미들웨어** — `json({ limit })`, `urlencoded({ limit })`. `req.body`에 디코드된 값 주입. 크기 제한 시 413.
6. **Keep-Alive** — 한 TCP 연결에서 여러 요청을 순차 처리. `Connection: close` / HTTP/1.0 시 즉시 종료. idle timeout 옵션.
7. **정적 파일 서빙** — `static(rootDir)` 미들웨어. path traversal 방지. content-type 추론. 디렉터리 listing 비활성.

## 4. API

```ts
const app = createApp();

app.use(json({ limit: 1024 * 1024 }));
app.get("/", (req, res) => res.text("hello"));
app.get("/users/:id", (req, res) => res.json({ id: req.params.id }));
app.post("/users", (req, res) => res.status(201).json(req.body));
app.use(staticFiles("./public"));

app.onError((err, req, res) => {
  const status = (err as any)?.status ?? 500;
  res.status(status).json({ error: err.message });
});

const handle = await app.listen({ port: 3000, host: "127.0.0.1" });
// handle.close() — graceful shutdown
```

### 주요 타입

```ts
interface FwRequest extends HttpRequest {
  params: Record<string, string>;     // path param
  query: Record<string, string>;       // url query (간단 파서)
  body: unknown;                       // body 미들웨어가 주입. 기본은 Buffer.
  url: { path: string; query: string }; // request-target 분해
}

type Handler = (req: FwRequest, res: ResponseBuilder, next?: NextFn) => void | Promise<void>;
type ErrorHandler = (err: unknown, req: FwRequest, res: ResponseBuilder) => void | Promise<void>;
type NextFn = (err?: unknown) => void;
```

## 5. 프로젝트 구조

```
src/framework/
  app.ts          # createApp, listen, 라이프사이클
  router.ts       # 라우트 매칭, path param 컴파일
  middleware.ts   # 미들웨어 체인 실행기
  response.ts     # ResponseBuilder
  body-parsers.ts # json, urlencoded
  static.ts       # staticFiles
  url.ts          # 간단 path/query 분해
  types.ts
test/integration/framework/
  server.test.ts          # 기본 라우팅 + 응답 코드
  router.test.ts          # path param, method
  middleware.test.ts      # use, 순서, next, onError
  body-parsers.test.ts    # json/urlencoded, 크기 제한
  keep-alive.test.ts      # pipeline 1 connection 다 요청
  static.test.ts          # 정상 + path traversal 거부
```

## 6. 테스트 전략

integration 메인. 실제 TCP 서버 띄우고 Node 빌트인 `fetch` 또는 raw socket으로 검증. mock 금지. `port: 0`로 충돌 방지.

핵심 케이스:

- 정상 라우팅 (`fetch` 200/201/404)
- path param (`/users/123`)
- 미들웨어 순서 (배열 순서대로, next 호출 안 하면 정지)
- onError가 동기/비동기 throw 모두 받아냄
- json body 디코드 + 크기 초과 시 413
- urlencoded body
- keep-alive: 한 연결에 두 요청 보내고 두 응답 받음
- `Connection: close` 시 한 번 응답 후 종료
- 정적 파일 서빙 200, `..` 포함 경로는 400
- HTTP/1.0 요청은 자동으로 connection: close

## 7. 코드 스타일 / 학습 포인트 주석 의무

다음 위치에 주석을 남긴다.

- TCP 소켓 → HttpRequestParser 연결: 한 메시지가 끝날 때마다 핸들러 호출, 같은 소켓에서 다음 메시지 수신
- 라우트 매칭: 정규식 컴파일 vs 단순 split의 trade-off
- 미들웨어 next 패턴: 호출 안 하면 응답 끊김
- onError: 4-arg 미들웨어 대신 별도 등록을 택한 이유 (마법 줄임)
- keep-alive: HTTP/1.1 default, HTTP/1.0은 명시적 keep-alive만, 어디서 connection을 닫는지

## 8. 승인 기준

- [ ] 위 6개 integration 테스트 파일 모두 통과
- [ ] `pnpm start framework` 데모 — `curl`로 4개 라우트 응답 확인
- [ ] `curl --http1.1` 한 연결에서 두 요청 보내 두 응답 받음 (keep-alive)
- [ ] path traversal 공격 거부 (400 또는 404)
- [ ] §7 학습 포인트 주석 모두 존재

## 9. 경계

### 항상

- 외부 lib 금지
- integration 테스트는 실제 fetch/socket
- onError 미설정이면 기본 500 응답이지만 stack은 노출 금지

### 먼저 물어볼 것

- 외부 lib 도입
- 디렉터리 구조 변경
- 새 라이프사이클 hook 추가

### 절대 금지

- HTTP 의미론을 우회한 임의 응답 (예: status 없이 200 가정)
- path traversal 허용
- mock으로 통합 테스트 대체

## 10. 작업 순서

1. spec
2. Server: TCP+파서 통합 + 1 라우트 하드코딩 → fetch 통과
3. Router (method/path/param) + 404
4. Middleware 체인 + onError
5. Response 빌더 (status/json/text/send/set)
6. Body parsers (json/urlencoded)
7. Keep-Alive
8. Static + 데모 앱 + README + CLI framework 모드
