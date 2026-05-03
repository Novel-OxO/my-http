# my-http

TypeScript + Node.js 기반으로 TCP 소켓부터 시작해서 직접 HTTP 파서를 만들고, 최종적으로 소규모 HTTP 프레임워크까지 만들어보는 학습 프로젝트.

## 기술 스택
- TypeScript
- Node.js 빌트인 (`net`, `dgram`)
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

### Phase 1.5. UDP 에코 서버와 TCP 비교
**목표:** `dgram` 모듈로 UDP 서버를 만들고 TCP와의 차이를 직접 체감

- `dgram.createSocket('udp4')`로 UDP 서버 띄우기, `message`/`listening`/`error` 이벤트 다루기
- 같은 echo 동작을 UDP로 구현하고 TCP 버전과 비교
- 패킷 손실/순서 뒤바뀜을 인위적으로 만들어보고 동작 차이 관찰
- **학습 포인트 (TCP vs UDP):**
  - 연결 지향(handshake, `connection` 이벤트) vs 비연결형(데이터그램 단위 송수신)
  - 신뢰성/순서 보장 vs best-effort
  - Stream(바이트 흐름, 경계 없음) vs Datagram(메시지 경계 보존)
  - 흐름 제어·혼잡 제어·재전송 유무
  - 헤더 오버헤드와 지연 특성, MTU/단편화 이슈
  - 사용처: HTTP·DB·SSH (TCP) vs DNS·실시간 영상·게임·QUIC 기반 HTTP/3 (UDP)
- **테스트:** integration에서 UDP 클라이언트로 echo 검증, 동일 시나리오의 TCP 결과와 비교

### Phase 2. HTTP 파서 모듈
**목표:** raw 바이트 → `HttpRequest` 객체로 변환하는 파서를 직접 작성

- 2-1) Request line 파싱 (`GET /path HTTP/1.1`)
- 2-2) Header 파싱 (CRLF, case-insensitive, multi-value)
- 2-3) Body 파싱: `Content-Length` 기반 → `Transfer-Encoding: chunked` 까지
- 2-4) 상태 머신 기반 incremental parser (한 번에 안 들어오는 경우 처리)
- 2-5) Response 직렬화 (status line, headers, body)
- **학습 포인트:** RFC 9112(HTTP/1.1 message format), 파서 상태머신, edge case (긴 헤더, 잘린 패킷)
- **테스트:** unit에 파서 케이스 빡빡하게 (정상/비정상/스트리밍 분할)

### Phase 3. 미니 HTTP 프레임워크
**목표:** Phase 1~2를 합쳐 Express-like 프레임워크

- 3-1) `Server` 클래스: TCP 위에 HTTP 파서 얹기
- 3-2) **Router**: method + path 매칭, path param (`/users/:id`)
- 3-3) **Middleware 체인**: `(req, res, next) => void`, 에러 미들웨어 분리
- 3-4) **Response 빌더**: `res.status().json()`, `res.send()`, content-type 자동 설정
- 3-5) Body 파서 미들웨어 (json, urlencoded)
- 3-6) Keep-Alive / connection 재사용
- 3-7) (옵션) 정적 파일 서빙, 간단한 에러 핸들러
- **테스트:** integration에서 실제 HTTP 클라이언트(`fetch` 또는 raw socket)로 라우팅·미들웨어 동작 확인

---

## 디렉토리 진화 (예정)

```
src/
  tcp/        # Phase 1
  udp/        # Phase 1.5
  http/       # Phase 2 — parser.ts, serializer.ts, types.ts
  framework/  # Phase 3 — server.ts, router.ts, middleware.ts, response.ts
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
| 1.5 | UDP echo 동작 + TCP와의 차이를 표/문서로 정리 |
| 2 | `curl`로 보낸 raw 요청을 100% 파싱 + chunked 처리 |
| 3 | 자체 프레임워크로 작성한 앱이 브라우저/`curl`에서 정상 응답 |

---

## 실행

```bash
pnpm install

# Phase 1 (TCP)
pnpm start server                      # TCP echo 서버 (PORT=3000 기본)
pnpm start client                      # 자체 TCP 클라이언트 (stdin REPL)
pnpm start backpressure                # backpressure 데모 (안전 경로)
WAIT_DRAIN=false pnpm start backpressure  # 무시 시 메모리 폭증 관찰
PORT=4000 pnpm start server            # 포트 변경

# Phase 1.5 (UDP)
pnpm start udp-server                  # UDP echo 서버 (UDP_PORT=41234 기본)
pnpm start udp-client                  # UDP 클라이언트 (응답 timeout 표시)
nc -u 127.0.0.1 41234                  # 수동 검증

pnpm test                              # 전체 테스트
pnpm test:integration                  # 통합 테스트만
```

상세 명세: `spec/01-tcp-echo-server.md`, `spec/02-udp-echo-server.md`.

---

## TCP vs UDP 핵심 차이 (이 프로젝트 코드 기준)

| 축 | TCP (`src/tcp/`) | UDP (`src/udp/`) |
|----|------------------|------------------|
| API | `net.createServer((socket) => ...)` | `dgram.createSocket('udp4')` |
| 연결 모델 | 연결 지향 (handshake) — `connection` 이벤트 | 비연결형 — `connection` 이벤트 없음 |
| 송신자 식별 | accepted socket이 곧 식별자 | 매 메시지의 `rinfo.address:port` |
| 응답 송신 | `socket.write(chunk)` | `socket.send(msg, port, address)` (명시적 주소) |
| 메시지 경계 | byte stream — `write` N번이 `data` 1~N번으로 임의 분할 | datagram — `send` N번이 `message` 정확히 N번 |
| 신뢰성/순서 | 보장 (재전송, 순서) | best-effort (손실/순서 뒤섞임 가능) |
| 흐름 제어 | 있음 — `write()=false` + `'drain'`으로 backpressure | 없음 — 송신자가 알아서 페이스 조절 |
| 0-byte 메시지 | 의미 없음 (no-op) | 유효한 메시지 |
| 라이프사이클 추적 | 활성 소켓 추적 + graceful drain 필요 | `socket.close()` 한 번 |
| 대표 사용처 | HTTP/1.1·DB·SSH | DNS·실시간 영상·게임·QUIC(HTTP/3 기반) |

각 행은 `test/integration/udp/comparison.test.ts`에서 같은 시나리오로 직접 비교 검증된다.
