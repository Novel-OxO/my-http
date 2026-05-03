# my-http

TypeScript + Node.js 기반으로 TCP 소켓부터 시작해서 직접 HTTP 파서를 만들고, 최종적으로 소규모 HTTP 프레임워크까지 만들어보는 학습 프로젝트.

## 기술 스택
- TypeScript
- Node.js 빌트인 (`net`, `worker_threads`, `cluster`)
- pnpm / ts-node / vitest

---

## 학습 로드맵

### Phase 1. TCP 에코 서버 (기초)
**목표:** `net` 모듈로 소켓 통신 흐름 체득

- `net.createServer`로 TCP 서버 띄우기, `connection`/`data`/`end`/`close` 이벤트 다루기
- 클라이언트가 보낸 buffer 그대로 echo
- `nc localhost <port>` / 직접 만든 TCP 클라이언트로 테스트
- **학습 포인트:** Stream 기반 I/O, Buffer vs string, `setEncoding`, backpressure 맛보기
- **테스트:** integration에서 실제 소켓 연결 후 echo 검증

### Phase 2. TCP 동시성 / 멀티스레딩
**목표:** Node에서 "멀티스레드"가 실제로 어떻게 동작하는지 이해

- 2-1) **단일 이벤트루프 + 다중 connection** 처리 먼저 (이미 Node가 잡아주는 구조 확인)
- 2-2) `worker_threads`로 작업 분산: accept는 메인, CPU 바운드 작업(예: 큰 메시지 해싱)을 워커로 위임
- 2-3) `cluster` 모듈로 SO_REUSEPORT 기반 워커 스케일링, 라운드로빈 분배 비교
- **학습 포인트:** Node 동시성 모델, 워커 통신(`postMessage`/IPC), 공유 상태의 어려움, graceful shutdown
- **테스트:** integration에서 동시 N개 연결 → 응답 시간/순서 검증

### Phase 3. HTTP 파서 모듈
**목표:** raw 바이트 → `HttpRequest` 객체로 변환하는 파서를 직접 작성

- 3-1) Request line 파싱 (`GET /path HTTP/1.1`)
- 3-2) Header 파싱 (CRLF, case-insensitive, multi-value)
- 3-3) Body 파싱: `Content-Length` 기반 → `Transfer-Encoding: chunked` 까지
- 3-4) 상태 머신 기반 incremental parser (한 번에 안 들어오는 경우 처리)
- 3-5) Response 직렬화 (status line, headers, body)
- **학습 포인트:** RFC 9112(HTTP/1.1 message format), 파서 상태머신, edge case (긴 헤더, 잘린 패킷)
- **테스트:** unit에 파서 케이스 빡빡하게 (정상/비정상/스트리밍 분할)

### Phase 4. 미니 HTTP 프레임워크
**목표:** Phase 1~3을 합쳐 Express-like 프레임워크

- 4-1) `Server` 클래스: TCP 위에 HTTP 파서 얹기
- 4-2) **Router**: method + path 매칭, path param (`/users/:id`)
- 4-3) **Middleware 체인**: `(req, res, next) => void`, 에러 미들웨어 분리
- 4-4) **Response 빌더**: `res.status().json()`, `res.send()`, content-type 자동 설정
- 4-5) Body 파서 미들웨어 (json, urlencoded)
- 4-6) Keep-Alive / connection 재사용
- 4-7) (옵션) 정적 파일 서빙, 간단한 에러 핸들러
- **테스트:** integration에서 실제 HTTP 클라이언트(`fetch` 또는 raw socket)로 라우팅·미들웨어 동작 확인

---

## 디렉토리 진화 (예정)

```
src/
  tcp/        # Phase 1~2
    echo-server.ts
    worker-pool.ts
  http/       # Phase 3
    parser.ts
    serializer.ts
    types.ts
  framework/  # Phase 4
    server.ts
    router.ts
    middleware.ts
    response.ts
  main.ts     # 단계별 데모 진입점
test/
  unit/http/parser.test.ts
  integration/tcp/echo.test.ts
  integration/framework/router.test.ts
```

---

## 단계별 완료 기준

| Phase | 완료 기준 |
|-------|-----------|
| 1 | echo가 동시 연결에서도 깨지지 않음 |
| 2 | 워커 N개에서 부하 분산 측정 가능 (간단한 부하 스크립트) |
| 3 | `curl`로 보낸 raw 요청을 100% 파싱 + chunked 처리 |
| 4 | 자체 프레임워크로 작성한 앱이 브라우저/`curl`에서 정상 응답 |

---

## 실행

```bash
pnpm install
pnpm start              # src/main.ts 실행
pnpm test               # 전체 테스트
pnpm test:unit          # 단위 테스트
pnpm test:integration   # 통합 테스트
```
