import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as net from "node:net";
import {
  createEchoServer,
  type EchoServerHandle,
} from "../../../src/tcp/echo-server";

function connect(port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

function once<T = void>(emitter: net.Server | net.Socket, event: string): Promise<T> {
  return new Promise((resolve) => {
    emitter.once(event, (arg: T) => resolve(arg));
  });
}

describe("echo server lifecycle", () => {
  let handle: EchoServerHandle;

  beforeEach(async () => {
    handle = await createEchoServer({ port: 0, host: "127.0.0.1" });
  });

  afterEach(async () => {
    if (handle.server.listening) await handle.close();
  });

  it("연결되면 activeConnections가 증가하고, close되면 0으로 돌아간다", async () => {
    expect(handle.activeConnections()).toBe(0);

    const a = await connect(handle.port);
    const b = await connect(handle.port);
    // 서버가 'connection' 이벤트를 처리할 수 있게 한 틱 양보
    await new Promise((r) => setImmediate(r));
    expect(handle.activeConnections()).toBe(2);

    a.end();
    b.end();
    // 양쪽 모두 close까지 가는 걸 기다린다
    await Promise.all([once(a, "close"), once(b, "close")]);
    await new Promise((r) => setImmediate(r));
    expect(handle.activeConnections()).toBe(0);
  });

  it("클라이언트 end() 시 서버 측 socket도 'end' 다음 'close' 순서로 이벤트가 난다", async () => {
    const sequence: string[] = [];
    handle.server.once("connection", (socket: net.Socket) => {
      socket.on("end", () => sequence.push("end"));
      socket.on("close", () => sequence.push("close"));
    });

    const client = await connect(handle.port);
    client.end();
    // 서버 socket close까지 기다리려면 클라 close까지 기다리는 게 가장 단순
    await once(client, "close");
    await new Promise((r) => setImmediate(r));

    expect(sequence).toEqual(["end", "close"]);
  });

  it("close() 이후에는 새 연결이 거부된다", async () => {
    const port = handle.port;
    await handle.close();

    await expect(connect(port)).rejects.toThrow(/ECONNREFUSED/);
  });

  it("graceful shutdown 도중 활성 연결은 drain된 뒤 정리된다", async () => {
    const client = await connect(handle.port);
    client.write("hi");

    // echo가 돌아온 뒤에 close를 시작
    await new Promise<void>((resolve) => {
      client.once("data", () => resolve());
    });

    const closePromise = handle.close();
    // 서버가 보내는 end를 받고 client도 close된다
    await once(client, "close");
    await closePromise;

    expect(handle.activeConnections()).toBe(0);
    expect(handle.server.listening).toBe(false);
  });
});
