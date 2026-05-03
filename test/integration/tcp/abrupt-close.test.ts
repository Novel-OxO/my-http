import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as net from "node:net";
import {
  createEchoServer,
  type EchoServerHandle,
} from "../../../src/tcp/echo-server";

/**
 * 클라이언트의 비정상 종료(socket.destroy → RST)에도 서버가 살아남고
 * 새 연결을 계속 받을 수 있어야 한다.
 */

function once<T = void>(emitter: net.Socket, event: string): Promise<T> {
  return new Promise((resolve) => emitter.once(event, (arg: T) => resolve(arg)));
}

describe("echo server abrupt close", () => {
  let handle: EchoServerHandle;

  beforeEach(async () => {
    handle = await createEchoServer({ port: 0, host: "127.0.0.1" });
  });

  afterEach(async () => {
    await handle.close();
  });

  it("클라이언트가 destroy하면 서버 측 socket의 close가 hadError=true로 끝나기도 한다", async () => {
    const serverSidePromise = new Promise<{ hadError: boolean }>((resolve) => {
      handle.server.once("connection", (sock: net.Socket) => {
        sock.once("close", (hadError: boolean) => resolve({ hadError }));
      });
    });

    const client = net.createConnection({ port: handle.port, host: "127.0.0.1" });
    await once(client, "connect");
    client.destroy();

    const { hadError } = await serverSidePromise;
    // OS/타이밍에 따라 RST가 hadError=true 또는 정상 close로 보일 수 있다.
    // 핵심은 close가 어떻게든 발생해 정리됨 — 서버가 멈추지 않는 것.
    expect(typeof hadError).toBe("boolean");
  });

  it("비정상 종료 후에도 서버는 계속 새 연결을 받는다", async () => {
    const dead = net.createConnection({ port: handle.port, host: "127.0.0.1" });
    await once(dead, "connect");
    dead.destroy();

    // 충분한 시간 후 새 연결로 echo 검증
    await new Promise((r) => setImmediate(r));

    const fresh = net.createConnection({ port: handle.port, host: "127.0.0.1" });
    await once(fresh, "connect");
    fresh.write("alive");
    const data: Buffer = await once(fresh, "data");
    expect(data.toString("utf8")).toBe("alive");
    fresh.end();
    await once(fresh, "close");
  });

  it("비정상 종료된 socket도 activeConnections에서 정리된다", async () => {
    const c = net.createConnection({ port: handle.port, host: "127.0.0.1" });
    await once(c, "connect");
    while (handle.activeConnections() === 0) {
      await new Promise((r) => setImmediate(r));
    }
    expect(handle.activeConnections()).toBe(1);

    c.destroy();
    while (handle.activeConnections() > 0) {
      await new Promise((r) => setImmediate(r));
    }
    expect(handle.activeConnections()).toBe(0);
  });
});
