import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as net from "node:net";
import {
  createEchoServer,
  type EchoServerHandle,
} from "../../../src/tcp/echo-server";

/**
 * 실제 TCP 소켓을 띄워 echo 동작을 검증한다.
 * port: 0 으로 listen 해서 OS가 빈 포트를 할당하도록 한다 (테스트 간 충돌 방지).
 */

async function connect(port: number, host = "127.0.0.1"): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port, host });
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

/**
 * 클라이언트에서 받은 모든 chunk를 합쳐 지정한 byte 수에 도달하면 Buffer를 돌려준다.
 */
function readBytes(socket: net.Socket, expected: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      received += chunk.length;
      if (received >= expected) {
        socket.off("data", onData);
        resolve(Buffer.concat(chunks, received));
      }
    };
    socket.on("data", onData);
    socket.once("error", reject);
  });
}

describe("echo server", () => {
  let handle: EchoServerHandle;

  beforeEach(async () => {
    handle = await createEchoServer({ port: 0, host: "127.0.0.1" });
  });

  afterEach(async () => {
    await handle.close();
  });

  it("'hello' 보내면 'hello'를 그대로 돌려받는다", async () => {
    const socket = await connect(handle.port);
    socket.write("hello");
    const echoed = await readBytes(socket, 5);
    expect(echoed.toString("utf8")).toBe("hello");
    socket.end();
  });

  it("한 연결에서 여러 번 write 해도 모두 echo 된다", async () => {
    const socket = await connect(handle.port);
    const reader = readBytes(socket, 9); // "abc"+"de"+"fghi"
    socket.write("abc");
    socket.write("de");
    socket.write("fghi");
    const echoed = await reader;
    expect(echoed.toString("utf8")).toBe("abcdefghi");
    socket.end();
  });

  it("0-byte write는 응답을 만들지 않지만 연결은 살아있다", async () => {
    const socket = await connect(handle.port);
    socket.write(Buffer.alloc(0));
    socket.write("ping");
    const echoed = await readBytes(socket, 4);
    expect(echoed.toString("utf8")).toBe("ping");
    socket.end();
  });
});
