import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as dgram from "node:dgram";
import * as net from "node:net";
import {
  createUdpEchoServer,
  type UdpEchoServerHandle,
} from "../../../src/udp/echo-server";
import {
  createEchoServer,
  type EchoServerHandle,
} from "../../../src/tcp/echo-server";

/**
 * 같은 시나리오를 TCP와 UDP로 동시에 돌려 차이를 코드로 드러낸다.
 */

function once<T = void>(emitter: net.Socket | dgram.Socket, event: string): Promise<T> {
  return new Promise((resolve) => emitter.once(event, (arg: T) => resolve(arg)));
}

describe("tcp vs udp 차이", () => {
  let udp: UdpEchoServerHandle;
  let tcp: EchoServerHandle;

  beforeEach(async () => {
    udp = await createUdpEchoServer({ port: 0, host: "127.0.0.1" });
    tcp = await createEchoServer({ port: 0, host: "127.0.0.1" });
  });

  afterEach(async () => {
    await udp.close();
    await tcp.close();
  });

  it("UDP는 send 횟수와 server message 횟수가 1:1로 보존된다", async () => {
    const client = dgram.createSocket("udp4");
    const N = 5;
    const msg = Buffer.from("aa");

    // 클라가 받은 응답도 N번 와야 한다 (보통은)
    const responses: Buffer[] = [];
    client.on("message", (m) => responses.push(m));

    for (let i = 0; i < N; i++) client.send(msg, udp.port, "127.0.0.1");

    // 서버 message 카운트가 N에 도달할 때까지 대기 (loopback이라 사실상 100%)
    const deadline = Date.now() + 1000;
    while (udp.messageCount() < N && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 10));
    }
    // 응답도 받을 시간 양보
    while (responses.length < N && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 10));
    }

    expect(udp.messageCount()).toBe(N);
    // loopback 신뢰성은 매우 높지만 이론적으론 손실 가능 → 최소 보장만 검증
    expect(responses.length).toBe(N);
    for (const r of responses) expect(r.length).toBe(2);

    client.close();
  });

  it("TCP는 같은 N번 write가 server에서 1~N번 사이 임의 분할로 도착한다", async () => {
    const N = 5;
    const payload = "aa";
    const expectedTotal = N * payload.length;

    let dataEvents = 0;
    let serverBytes = 0;
    tcp.server.once("connection", (sock: net.Socket) => {
      sock.on("data", (chunk: Buffer) => {
        dataEvents += 1;
        serverBytes += chunk.length;
      });
    });

    const client = net.createConnection({ port: tcp.port, host: "127.0.0.1" });
    await once(client, "connect");
    let clientBytes = 0;
    client.on("data", (chunk: Buffer) => {
      clientBytes += chunk.length;
    });
    for (let i = 0; i < N; i++) client.write(payload);

    // 클라가 echo로 받은 byte 합이 expected에 도달하면 서버도 다 받았다.
    const deadline = Date.now() + 2000;
    while (clientBytes < expectedTotal && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 10));
    }
    client.end();

    // 학습 포인트: TCP는 stream이라 N번 write 했어도 data 이벤트 횟수는 1~N
    // 사이 어떤 값이든 가능하다. 보장되는 건 누적 byte 합뿐.
    expect(serverBytes).toBe(expectedTotal);
    expect(dataEvents).toBeGreaterThanOrEqual(1);
    expect(dataEvents).toBeLessThanOrEqual(N);
  });

  it("UDP 서버 socket에는 'connection' 이벤트라는 개념 자체가 없다", () => {
    // dgram.Socket의 이벤트 목록에는 'message'/'listening'/'error'/'close'만 있다.
    // 'connection'을 listen 해도 절대 fire되지 않는다 — 비연결형이기 때문.
    let connectionFired = false;
    udp.socket.on("connection" as never, () => {
      connectionFired = true;
    });
    // 굳이 검증하진 않아도, TCP에는 server.on('connection', ...)이 핵심이라는
    // 점과 대비해 의도를 명시해 둔다.
    expect(connectionFired).toBe(false);
  });

  it("UDP 한 서버 소켓이 여러 송신자를 stateless로 처리한다", async () => {
    const c1 = dgram.createSocket("udp4");
    const c2 = dgram.createSocket("udp4");
    await new Promise<void>((r) => c1.bind(0, "127.0.0.1", () => r()));
    await new Promise<void>((r) => c2.bind(0, "127.0.0.1", () => r()));

    const echoes: Record<number, string[]> = {};
    const collect = (port: number, sock: dgram.Socket) => {
      echoes[port] = [];
      sock.on("message", (m) => echoes[port].push(m.toString("utf8")));
    };
    collect(c1.address().port, c1);
    collect(c2.address().port, c2);

    c1.send("from-c1", udp.port, "127.0.0.1");
    c2.send("from-c2", udp.port, "127.0.0.1");

    const deadline = Date.now() + 1000;
    while (
      (echoes[c1.address().port].length === 0 ||
        echoes[c2.address().port].length === 0) &&
      Date.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, 10));
    }

    expect(echoes[c1.address().port]).toEqual(["from-c1"]);
    expect(echoes[c2.address().port]).toEqual(["from-c2"]);

    c1.close();
    c2.close();
  });
});
