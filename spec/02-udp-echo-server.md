# Spec 02. UDP 에코 서버 + TCP 비교

## 1. 목표

Node `dgram`으로 UDP 에코 서버/클라이언트를 만들고 **같은 echo 동작을 TCP로 짠 Phase 1 코드와 직접 비교**하여, 다음을 코드와 테스트로 체감한다.

- 연결 지향 vs 비연결형
- Stream(byte 흐름) vs Datagram(메시지 경계 보존)
- 신뢰성/순서 보장 vs best-effort
- 흐름 제어·재전송 유무
- 사용처와 trade-off

## 2. 비목표

- DNS/QUIC/HTTP3 같은 상위 프로토콜 구현
- 신뢰성 추가(ARQ, FEC) — 학습이지 재발명 아님
- 멀티캐스트/브로드캐스트 (필요해지면 별도 spec)

## 3. 범위

1. **UDP 에코 서버** (`src/udp/echo-server.ts`)
   - `dgram.createSocket('udp4')`
   - `listening` / `message` / `error` / `close` 이벤트 모두 처리
   - `message` 콜백에서 받은 buffer를 그대로 송신자에게 다시 send
   - graceful shutdown: `socket.close()` + 종료 대기

2. **UDP 클라이언트** (`src/udp/echo-client.ts`)
   - 송신 → 응답 수신 흐름. stdin REPL 형태 (TCP 클라이언트와 같은 UX 유지)
   - 응답 timeout 처리 (UDP는 무응답이 정상일 수 있음)

3. **CLI 통합** (`src/main.ts`)
   - 모드: `udp-server` / `udp-client`

4. **비교 테스트** (`test/integration/udp/comparison.test.ts`)
   - **메시지 경계 보존**: 클라가 3번 send 하면 서버는 3번 message 이벤트 수신
   - **비연결형**: 서버는 `connection` 이벤트가 없고, 한 소켓이 여러 송신자를 처리
   - **stateless**: 서버 입장에선 동일 클라이언트인지 식별할 단서가 src ip:port 뿐
   - (옵션) 작은 손실 시뮬: 일부 패킷을 일부러 drop 했을 때 클라가 재시도/타임아웃 처리

## 4. 설정

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `UDP_PORT` | `41234` | UDP 서버/클라이언트 포트 |
| `UDP_HOST` | `127.0.0.1` | bind/접속 호스트 |
| `LOG_LEVEL` | `info` | Phase 1과 공유 |

TCP의 `PORT`와 별개 변수로 둔다. 두 서버를 동시에 띄워 비교할 수 있도록.

## 5. 프로젝트 구조

```
src/udp/
  echo-server.ts
  echo-client.ts
test/integration/udp/
  echo.test.ts
  comparison.test.ts
```

## 6. 코드 스타일 / 학습 포인트 주석 의무

다음 위치에 짧은 주석을 남긴다.

- `dgram.createSocket('udp4')` 위에: TCP의 `net.createServer`와 달리 connection 콜백이 없는 이유 (비연결형)
- `message` 핸들러: `(msg, rinfo)` 시그니처와 `rinfo.address`/`rinfo.port`로만 송신자를 식별한다는 점 (stateless)
- `socket.send(msg, port, address, cb)`: 응답을 명시적 주소로 보내야 한다는 점 (TCP `socket.write`와 다름)
- 메시지 경계 보존: 한 번의 send = 한 번의 message (단, MTU 초과 시 IP 단편화 발생 가능)
- 신뢰성 없음: ack/재전송 없음, 도착/순서 보장 없음 — best-effort

## 7. 테스트 전략

vitest integration. mock 금지, 실제 dgram 소켓.

### 7.1 echo.test.ts

- 단일 메시지 echo
- 여러 메시지 echo (각자 독립적으로 도착)
- 0-byte datagram (UDP는 0-byte payload도 유효한 메시지)

### 7.2 comparison.test.ts (핵심 학습 포인트)

- **메시지 경계 보존**: 3번 `send("aa")` → 서버 message 이벤트 3번, 각 msg.length=2
- **TCP 대조**: 같은 시나리오를 TCP로 했을 때 서버 'data' 이벤트는 1~3번 사이로 임의 분할됨을 같은 테스트에서 함께 보여 학습 포인트를 코드로 드러낸다
- **비연결형**: 서로 다른 클라 2개가 같은 서버에 send → 서버는 두 rinfo로 구분. server에는 'connection' 이벤트가 없다 (handle.server에 connection listener가 등록 가능한지 검사)
- **방화/재시작 시나리오**: 클라가 보냈는데 서버가 닫혀있으면 — 보통 ICMP Unreachable이 와서 send 콜백이 에러로 끝나거나, 타이밍에 따라 silently drop. 둘 다 허용으로 본다.

## 8. 승인 기준

- [ ] integration 테스트 (echo + comparison) 모두 통과
- [ ] `pnpm start udp-server` 띄운 상태에서 `nc -u 127.0.0.1 41234`로 echo 수동 확인
- [ ] `pnpm start udp-client`로 자체 클라가 자체 서버와 송수신 확인
- [ ] §6의 5개 학습 포인트 주석 모두 존재
- [ ] README에 TCP vs UDP 비교 표 추가

## 9. 경계

### 항상

- 모든 dgram 이벤트 등록
- 인코딩 명시 (`msg.toString('utf8')` 등)
- TCP 코드와 동일한 입출력 시나리오를 가능한 한 유지해 비교 가능성 확보

### 먼저 물어볼 것

- 외부 라이브러리 도입
- IPv6 (`udp6`) 추가
- 손실/지연 시뮬레이션 도구 도입 (tc, netem 등)

### 절대 금지

- UDP 위에 신뢰성 레이어 직접 추가 (학습 범위 밖)
- 멀티캐스트/브로드캐스트
- mock으로 통합 테스트 대체

## 10. 작업 순서

1. spec (이 문서)
2. UDP 서버 + echo.test.ts
3. UDP 클라이언트 + CLI 통합 (`udp-server`/`udp-client` 모드)
4. comparison.test.ts (TCP 대조 포함)
5. README 업데이트 (실행 명령 + TCP vs UDP 표)
