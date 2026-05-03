import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as net from "node:net";
import * as crypto from "node:crypto";
import {
  createEchoServer,
  type EchoServerHandle,
} from "../../../src/tcp/echo-server";

/**
 * 큰 페이로드 echo로 backpressure 경로를 실제로 트리거한다.
 */

describe("echo server large payload", () => {
  let handle: EchoServerHandle;

  beforeEach(async () => {
    handle = await createEchoServer({ port: 0, host: "127.0.0.1" });
  });

  afterEach(async () => {
    await handle.close();
  });

  it("10MB 페이로드를 보내면 동일한 바이트가 그대로 돌아온다", async () => {
    const payload = crypto.randomBytes(10 * 1024 * 1024);
    const expected = payload.length;

    const echoed = await new Promise<Buffer>((resolve, reject) => {
      const socket = net.createConnection({ port: handle.port, host: "127.0.0.1" });
      const chunks: Buffer[] = [];
      let received = 0;
      let chunkCount = 0;

      socket.on("connect", () => {
        // highWaterMark 이상을 한 번에 write — 큰 buffer는 내부적으로 나뉘어 전송된다
        socket.write(payload);
      });
      socket.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
        received += chunk.length;
        chunkCount += 1;
        if (received >= expected) {
          socket.end();
        }
      });
      socket.on("error", reject);
      socket.on("close", () => {
        // TCP는 stream — 한 번 write한 게 여러 chunk로 쪼개져 도착하는 게 정상
        // (학습 포인트: 메시지 경계 보존 안 됨)
        if (chunkCount < 2) {
          reject(new Error(`expected fragmentation, got ${chunkCount} chunk`));
          return;
        }
        resolve(Buffer.concat(chunks, received));
      });
    });

    expect(echoed.length).toBe(payload.length);
    expect(echoed.equals(payload)).toBe(true);
  });

  it("backpressure 경로가 실제로 한 번 이상 트리거된다", async () => {
    const payload = crypto.randomBytes(10 * 1024 * 1024);

    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ port: handle.port, host: "127.0.0.1" });
      let received = 0;

      socket.on("connect", () => socket.write(payload));
      socket.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (received >= payload.length) socket.end();
      });
      socket.on("error", reject);
      socket.on("close", () => resolve());
    });

    expect(handle.stats().backpressureHits).toBeGreaterThan(0);
  });
});
