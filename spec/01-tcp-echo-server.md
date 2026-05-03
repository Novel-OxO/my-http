# Spec 01. TCP 에코 서버

## 1. 목표 (Goal)

Node.js `net` 모듈만으로 TCP 에코 서버와 직접 만든 TCP 클라이언트를 구현하고, Stream 기반 I/O / Buffer / `setEncoding` / backpressure를 코드와 테스트로 직접 체감한다.

**학습 목적이 우선**이므로, 외부 라이브러리는 사용하지 않고 Node 빌트인만 쓴다. 동작이 맞는 것 이상으로 "왜 이렇게 동작하는가"를 코드 주석/테스트 케이스로 증명한다.

### 비목표 (Non-goals)

- HTTP 파싱 (Phase 3)
- 멀티스레드/cluster (Phase 2)
- TLS, 인증, 라우팅
- 프로덕션 수준의 로깅/메트릭

---

## 2. 범위 (Scope)

학습이므로 Phase 1에 **전부 포함**한다.

1. **TCP 에코 서버** (`src/tcp/echo-server.ts`)
   - `net.createServer`로 서버 생성
   - `connection` / `data` / `end` / `close` / `error` 이벤트 모두 처리
   - 받은 buffer를 그대로 echo
   - graceful shutdown (`SIGINT` / `SIGTERM` → `server.close()` + 활성 소켓 정리)

2. **TCP 클라이언트** (`src/tcp/echo-client.ts`)
   - `net.createConnection`으로 서버에 접속
   - stdin → 서버, 서버 → stdout 양방향 파이프 (간단 REPL 형태)
   - `connect` / `data` / `end` / `error` / `close` 이벤트 처리

3. **Backpressure 데모** (`src/tcp/backpressure-demo.ts`)
   - 서버가 클라이언트로 큰 페이로드를 빠르게 쏠 때 `socket.write()` 반환값이 `false`가 되는 시점을 관찰
   - `false` 받으면 `'drain'` 이벤트까지 기다리는 패턴 구현
   - 비교군: 무시하고 계속 write 했을 때의 메모리 사용량 차이를 콘솔로 출력

4. **데모 진입점** (`src/main.ts`)
   - CLI 인자로 `server | client | backpressure` 분기

---

## 3. 커맨드 (Commands)

```bash
pnpm install
pnpm start server                    # echo 서버 실행
pnpm start client                    # echo 클라이언트 실행 (stdin REPL)
pnpm start backpressure              # backpressure 데모 실행

PORT=4000 pnpm start server          # 포트 변경
HOST=127.0.0.1 PORT=4000 pnpm start client

pnpm test:integration                # integration 테스트 (vitest)
pnpm test                            # 전체 테스트
```

수동 검증:

```bash
# 한쪽 터미널
pnpm start server

# 다른 터미널
nc localhost 3000
> hello
hello                                # echo 확인
^C                                   # 클라이언트 종료 → 서버에 'end'/'close' 출력
```

---

## 4. 설정 (Configuration)

환경변수만 사용한다. 하드코딩 금지.

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3000` | 서버 listen 포트 / 클라이언트 접속 포트 |
| `HOST` | `127.0.0.1` | 서버 bind / 클라이언트 접속 호스트 |
| `LOG_LEVEL` | `info` | `debug` / `info` / `silent` (학습용 console 래퍼) |

---

## 5. 프로젝트 구조

```
src/
  tcp/
    echo-server.ts          # createEchoServer({ port, host }) 팩토리 + main
    echo-client.ts          # createEchoClient + main
    backpressure-demo.ts    # write/drain 패턴 데모
    log.ts                  # LOG_LEVEL 기반 간단 로거
  main.ts                   # CLI 라우팅 (server | client | backpressure)
test/
  integration/
    tcp/
      echo.test.ts          # echo 정상 동작
      lifecycle.test.ts     # connection/end/close 이벤트, graceful shutdown
      concurrency.test.ts   # 동시 N개 연결
      large-payload.test.ts # 큰 페이로드 echo (backpressure 영향)
      abrupt-close.test.ts  # 클라이언트 RST / 강제 종료 처리
```

---

## 6. 코드 스타일

- TypeScript strict mode
- 함수형 팩토리 우선 (`createEchoServer({ port, host }): net.Server`), 클래스는 상태가 클 때만
- side-effect가 있는 entry point(`main`)와 순수 팩토리는 같은 파일 안에서 분리
- Buffer ↔ string 변환은 항상 인코딩 명시 (`buf.toString('utf8')`)
- `socket.setEncoding`은 학습 차원에서 한 번 사용해보고 주석으로 trade-off 기록 (binary safety 손실)
- 주석은 **why**만 (이 스펙의 학습 포인트가 발현되는 지점에는 주석을 남긴다)

### 학습 포인트 노출 (코드 주석으로 명시)

다음 위치에는 짧은 주석을 의무적으로 남긴다.

- `data` 이벤트가 메시지 경계를 보장하지 않는 이유 (TCP는 stream)
- `setEncoding('utf8')`을 켰을 때와 껐을 때의 차이
- `socket.write()` 반환값과 `'drain'` 이벤트 관계
- `end` vs `close` 이벤트 차이 (half-close 가능성)
- graceful shutdown 시 새 연결 거부 + 기존 연결 drain 흐름

---

## 7. 테스트 전략

vitest integration project에서 **실제 TCP 소켓**으로 검증한다. mock 금지.

각 테스트는 사용 가능한 임의 포트(`port: 0`)로 서버를 띄운 뒤 `server.address()`에서 실제 포트를 받아 사용한다. 테스트 간 포트 충돌 방지.

### 7.1 echo.test.ts — 기본 echo

- "hello" 보내면 "hello" 받는다
- 한 연결에서 여러 번 write 해도 모두 echo 된다
- 빈 chunk(0 byte write) 처리

### 7.2 lifecycle.test.ts — 이벤트 라이프사이클

- 클라이언트 접속 시 서버에 `connection` 이벤트 발생
- 클라이언트가 `end()` 호출 시 서버에 `end` → `close` 순서로 이벤트
- `server.close()` 호출 후 새 connect 거부
- `SIGINT` 모사: graceful shutdown 도중 활성 연결은 drain 후 종료

### 7.3 concurrency.test.ts — 동시 연결

- 동시에 50개 클라이언트 접속, 각자 echo 검증
- 모든 연결이 독립적으로 처리되는지 (응답 섞임 없음)
- 연결 수 카운터가 정확히 0으로 돌아오는지

### 7.4 large-payload.test.ts — 큰 페이로드

- 10MB buffer를 한 번에 write → 분할되어 도착하는 것 확인
- chunk를 모아 원본과 동일한지 검증
- backpressure 코드 경로(`write() === false`)가 실제로 트리거되는지 카운트

### 7.5 abrupt-close.test.ts — 비정상 종료

- 클라이언트가 `socket.destroy()`로 RST 보낼 때 서버에 `error` 또는 `close({ hadError: true })` 발생
- 그 후에도 서버가 계속 살아있고 새 연결을 받을 수 있는지

---

## 8. 승인 기준 (Acceptance Criteria)

다음을 모두 만족해야 Phase 1을 완료로 본다.

- [ ] `pnpm test:integration`에서 위 5개 테스트 파일이 모두 통과
- [ ] `pnpm start server` 띄운 상태에서 `nc localhost 3000`로 echo 수동 확인
- [ ] `pnpm start client`로 자체 클라이언트가 자체 서버와 정상 통신
- [ ] backpressure 데모에서 `write() === false` 로그가 실제로 출력됨
- [ ] graceful shutdown: `Ctrl+C`로 종료 시 활성 연결이 drain된 후 프로세스 exit
- [ ] 코드 주석에 §6의 5가지 학습 포인트가 모두 등장

---

## 9. 경계 (Boundaries)

### 항상 할 것

- 이벤트 핸들러는 모두 등록 (조용히 무시 금지)
- 모든 I/O 경로에 명시적 인코딩
- 테스트는 실제 소켓 사용
- 학습 포인트 주석 의무

### 먼저 물어볼 것

- 외부 라이브러리(예: `pino`, `commander`)를 도입하고 싶을 때
- 디렉토리 구조를 README와 다르게 가져가야 할 때
- 테스트에서 실제 소켓이 아닌 다른 방식이 필요해 보일 때

### 절대 하지 말 것

- HTTP 의미론 끌어들이기 (Phase 3)
- `worker_threads` / `cluster` 사용 (Phase 2)
- 라이브러리로 echo 구현 대체
- mock으로 통합 테스트 대체
- 동작은 되지만 학습 포인트가 드러나지 않는 "그냥 된다" 코드

---

## 10. 작업 순서 (제안)

1. `src/tcp/log.ts` + `src/main.ts` CLI 골격
2. `src/tcp/echo-server.ts` 최소 echo + `echo.test.ts` 통과
3. lifecycle 이벤트 + `lifecycle.test.ts`
4. `src/tcp/echo-client.ts` + 수동 검증
5. concurrency 테스트
6. large-payload 테스트 → backpressure 핸들링 추가 → `backpressure-demo.ts`
7. abrupt-close 테스트
8. graceful shutdown 마무리
9. 학습 포인트 주석 점검 + README 업데이트

각 단계는 commit 단위가 된다 (`incremental-implementation` 스킬과 정렬).
