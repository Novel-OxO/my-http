import { afterEach, describe, expect, it } from "vitest";
import { createApp, type AppHandle } from "../../../src/framework/app";

describe("response builder", () => {
  let handle: AppHandle;
  afterEach(async () => {
    await handle.close();
  });

  it("res.status().json() 체이닝", async () => {
    const app = createApp();
    app.get("/", (_req, res) => res.status(202).json({ ok: 1 }));
    handle = await app.listen({ port: 0 });

    const r = await fetch(`http://127.0.0.1:${handle.port}/`);
    expect(r.status).toBe(202);
    expect(r.headers.get("content-type")).toMatch(/application\/json/);
    expect(await r.json()).toEqual({ ok: 1 });
  });

  it("res.text는 text/plain", async () => {
    const app = createApp();
    app.get("/", (_req, res) => res.text("plain"));
    handle = await app.listen({ port: 0 });
    const r = await fetch(`http://127.0.0.1:${handle.port}/`);
    expect(r.headers.get("content-type")).toMatch(/text\/plain/);
    expect(await r.text()).toBe("plain");
  });

  it("res.send(Buffer)는 application/octet-stream", async () => {
    const app = createApp();
    app.get("/", (_req, res) => res.send(Buffer.from([1, 2, 3])));
    handle = await app.listen({ port: 0 });
    const r = await fetch(`http://127.0.0.1:${handle.port}/`);
    expect(r.headers.get("content-type")).toBe("application/octet-stream");
    const buf = Buffer.from(await r.arrayBuffer());
    expect(Array.from(buf)).toEqual([1, 2, 3]);
  });

  it("res.set으로 사용자 헤더 설정", async () => {
    const app = createApp();
    app.get("/", (_req, res) => {
      res.set("X-Custom", "hello").text("ok");
    });
    handle = await app.listen({ port: 0 });
    const r = await fetch(`http://127.0.0.1:${handle.port}/`);
    expect(r.headers.get("x-custom")).toBe("hello");
  });

  it("사용자가 content-type을 미리 설정하면 자동 추론으로 덮어쓰지 않음", async () => {
    const app = createApp();
    app.get("/", (_req, res) => {
      res.set("Content-Type", "application/xml").send("<x/>");
    });
    handle = await app.listen({ port: 0 });
    const r = await fetch(`http://127.0.0.1:${handle.port}/`);
    expect(r.headers.get("content-type")).toBe("application/xml");
    expect(await r.text()).toBe("<x/>");
  });

  it("res.end()는 빈 본문", async () => {
    const app = createApp();
    app.get("/", (_req, res) => res.status(204).end());
    handle = await app.listen({ port: 0 });
    const r = await fetch(`http://127.0.0.1:${handle.port}/`);
    expect(r.status).toBe(204);
    expect((await r.text()).length).toBe(0);
  });
});
