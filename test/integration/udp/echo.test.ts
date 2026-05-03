import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as dgram from "node:dgram";
import {
  createUdpEchoServer,
  type UdpEchoServerHandle,
} from "../../../src/udp/echo-server";

/**
 * UDP는 연결이 없어 "send 한 번 → 한 번의 응답을 기다린다"가 기본 단위.
 */

function sendAndReceive(
  serverPort: number,
  payload: Buffer,
  timeoutMs = 1000,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket("udp4");
    const timer = setTimeout(() => {
      client.close();
      reject(new Error("udp response timeout"));
    }, timeoutMs);

    client.once("message", (msg) => {
      clearTimeout(timer);
      client.close(() => resolve(msg));
    });
    client.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    client.send(payload, serverPort, "127.0.0.1");
  });
}

describe("udp echo server", () => {
  let handle: UdpEchoServerHandle;

  beforeEach(async () => {
    // port: 0 으로 OS 할당 받기
    handle = await createUdpEchoServer({ port: 0, host: "127.0.0.1" });
  });

  afterEach(async () => {
    await handle.close();
  });

  it("'hello' datagram을 보내면 그대로 돌려받는다", async () => {
    const echoed = await sendAndReceive(handle.port, Buffer.from("hello"));
    expect(echoed.toString("utf8")).toBe("hello");
    expect(handle.messageCount()).toBe(1);
  });

  it("0-byte datagram도 유효한 메시지로 처리된다", async () => {
    const echoed = await sendAndReceive(handle.port, Buffer.alloc(0));
    expect(echoed.length).toBe(0);
    expect(handle.messageCount()).toBe(1);
  });

  it("바이너리 페이로드도 그대로 echo 된다", async () => {
    const payload = Buffer.from([0x00, 0xff, 0x10, 0x7f, 0x80]);
    const echoed = await sendAndReceive(handle.port, payload);
    expect(echoed.equals(payload)).toBe(true);
  });
});
