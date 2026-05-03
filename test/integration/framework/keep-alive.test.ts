import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as net from "node:net";
import { createApp, type AppHandle } from "../../../src/framework/app";
import { HttpResponseParser } from "../../../src/http/parser";
import type { HttpResponse } from "../../../src/http/types";

/**
 * keep-alive: 한 TCP 연결에서 여러 HTTP request/response를 순차 처리.
 * fetch는 매번 새 connection을 쓸 수 있어 raw socket으로 검증한다.
 */

function rawRequest(port: number, requests: string[]): Promise<HttpResponse[]> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    const parser = new HttpResponseParser();
    const out: HttpResponse[] = [];

    socket.on("connect", async () => {
      // 첫 응답 받은 뒤 다음 요청을 보내는 게 아니라, raw로 같은 연결에 두 요청을
      // 연속으로 흘려보낸다. (HTTP/1.1 pipelining + keep-alive)
      socket.write(requests.join(""));
    });
    socket.on("data", (chunk: Buffer) => {
      try {
        parser.feed(chunk);
      } catch (err) {
        reject(err);
        return;
      }
      while (true) {
        const r = parser.next();
        if (!r) break;
        out.push(r);
      }
    });
    socket.on("error", reject);
    socket.on("close", () => resolve(out));
  });
}

describe("keep-alive", () => {
  let handle: AppHandle;

  beforeEach(async () => {
    const app = createApp({ keepAliveTimeoutMs: 1000 });
    app.get("/a", (_req, res) => res.text("AA"));
    app.get("/b", (_req, res) => res.text("BB"));
    handle = await app.listen({ port: 0 });
  });

  afterEach(async () => {
    await handle.close();
  });

  it("HTTP/1.1 한 연결에서 두 요청 → 두 응답", async () => {
    const responses = await rawRequest(handle.port, [
      "GET /a HTTP/1.1\r\nHost: x\r\n\r\n",
      "GET /b HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n",
    ]);
    expect(responses.length).toBe(2);
    expect(responses[0].body.toString("utf8")).toBe("AA");
    expect(responses[1].body.toString("utf8")).toBe("BB");
  });

  it("HTTP/1.0 기본은 한 응답 후 close", async () => {
    const responses = await rawRequest(handle.port, [
      "GET /a HTTP/1.0\r\nHost: x\r\n\r\n",
      // 두 번째 요청은 보내봐야 서버가 이미 close 했을 것
      "GET /b HTTP/1.0\r\nHost: x\r\n\r\n",
    ]);
    // 적어도 첫 응답은 와야 한다
    expect(responses.length).toBeGreaterThanOrEqual(1);
    expect(responses[0].body.toString("utf8")).toBe("AA");
  });

  it("Connection: close가 명시되면 한 응답 후 close", async () => {
    const responses = await rawRequest(handle.port, [
      "GET /a HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n",
      "GET /b HTTP/1.1\r\nHost: x\r\n\r\n",
    ]);
    expect(responses.length).toBe(1);
    expect(responses[0].body.toString("utf8")).toBe("AA");
  });
});
