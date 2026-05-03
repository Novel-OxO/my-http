import { afterEach, describe, expect, it } from "vitest";
import { createApp, type AppHandle } from "../../../src/framework/app";
import { json, urlencoded } from "../../../src/framework/body-parsers";

describe("body parsers", () => {
  let handle: AppHandle;
  afterEach(async () => {
    await handle.close();
  });

  it("json 미들웨어가 application/json body를 객체로 디코드", async () => {
    const app = createApp();
    app.use(json());
    app.post("/echo", (req, res) => res.json(req.body));
    handle = await app.listen({ port: 0 });

    const r = await fetch(`http://127.0.0.1:${handle.port}/echo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "alice", age: 30 }),
    });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ name: "alice", age: 30 });
  });

  it("malformed JSON은 400", async () => {
    const app = createApp();
    app.use(json());
    app.post("/echo", (req, res) => res.json(req.body));
    handle = await app.listen({ port: 0 });

    const r = await fetch(`http://127.0.0.1:${handle.port}/echo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    expect(r.status).toBe(400);
  });

  it("limit 초과는 413", async () => {
    const app = createApp();
    app.use(json({ limit: 16 }));
    app.post("/echo", (req, res) => res.json(req.body));
    handle = await app.listen({ port: 0 });

    const r = await fetch(`http://127.0.0.1:${handle.port}/echo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ x: "a".repeat(100) }),
    });
    expect(r.status).toBe(413);
  });

  it("content-type 안 맞으면 패스 (rawBody 그대로)", async () => {
    const app = createApp();
    app.use(json());
    app.post("/echo", (req, res) => {
      // body가 디코드 안 됐으니 raw Buffer 그대로
      res.send(req.rawBody);
    });
    handle = await app.listen({ port: 0 });

    const r = await fetch(`http://127.0.0.1:${handle.port}/echo`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "raw text",
    });
    expect(await r.text()).toBe("raw text");
  });

  it("urlencoded 미들웨어가 form 데이터를 객체로 디코드", async () => {
    const app = createApp();
    app.use(urlencoded());
    app.post("/login", (req, res) => res.json(req.body));
    handle = await app.listen({ port: 0 });

    const r = await fetch(`http://127.0.0.1:${handle.port}/login`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "user=alice&pw=hunter2&note=hello+world",
    });
    expect(await r.json()).toEqual({ user: "alice", pw: "hunter2", note: "hello world" });
  });
});
