import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as net from "node:net";
import {
  createEchoServer,
  type EchoServerHandle,
} from "../../../src/tcp/echo-server";

/**
 * 동시 N개 연결 echo 검증.
 * 각 연결에 고유 payload를 넣어 응답이 절대 섞이지 않음을 확인한다.
 */

function once<T = void>(emitter: net.Socket, event: string): Promise<T> {
  return new Promise((resolve) => emitter.once(event, (arg: T) => resolve(arg)));
}

async function echoOnce(port: number, payload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    const chunks: Buffer[] = [];
    let received = 0;
    const expected = Buffer.byteLength(payload, "utf8");

    socket.on("connect", () => socket.write(payload));
    socket.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      received += chunk.length;
      if (received >= expected) {
        socket.end();
      }
    });
    socket.on("error", reject);
    socket.on("close", () => {
      resolve(Buffer.concat(chunks, received).toString("utf8"));
    });
  });
}

describe("echo server concurrency", () => {
  let handle: EchoServerHandle;

  beforeEach(async () => {
    handle = await createEchoServer({ port: 0, host: "127.0.0.1" });
  });

  afterEach(async () => {
    await handle.close();
  });

  it("동시 50개 연결의 응답이 각자 자기 payload를 정확히 받는다", async () => {
    const N = 50;
    const payloads = Array.from({ length: N }, (_, i) => `client-${i}-payload`);

    const responses = await Promise.all(
      payloads.map((p) => echoOnce(handle.port, p)),
    );

    expect(responses).toEqual(payloads);
  });

  it("부하 후 activeConnections는 0으로 돌아온다", async () => {
    const N = 30;
    await Promise.all(
      Array.from({ length: N }, (_, i) => echoOnce(handle.port, `p${i}`)),
    );
    // 모든 클라가 close까지 끝났지만 서버 측 socket close가 약간 늦을 수 있음
    while (handle.activeConnections() > 0) {
      await new Promise((r) => setImmediate(r));
    }
    expect(handle.activeConnections()).toBe(0);
  });

  it("한 연결의 강제 종료가 다른 연결에 영향을 주지 않는다", async () => {
    const stable = net.createConnection({ port: handle.port, host: "127.0.0.1" });
    await once(stable, "connect");

    const aborted = net.createConnection({ port: handle.port, host: "127.0.0.1" });
    await once(aborted, "connect");
    aborted.destroy();

    // stable이 여전히 echo 받는지 확인
    stable.write("still-alive");
    const data: Buffer = await once(stable, "data");
    expect(data.toString("utf8")).toBe("still-alive");
    stable.end();
    await once(stable, "close");
  });
});
