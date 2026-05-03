import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, type AppHandle } from "../../../src/framework/app";

describe("router", () => {
  let handle: AppHandle;

  beforeEach(async () => {
    const app = createApp();
    app.get("/", (_req, res) => res.text("home"));
    app.get("/users/:id", (req, res) => res.json({ id: req.params.id }));
    app.get("/a/:x/b/:y", (req, res) => res.json(req.params));
    app.post("/users", (_req, res) => res.status(201).json({ created: true }));
    app.delete("/users/:id", (req, res) => res.status(204).end());
    handle = await app.listen({ port: 0 });
  });

  afterEach(async () => {
    await handle.close();
  });

  it("path param 캡처", async () => {
    const r = await fetch(`http://127.0.0.1:${handle.port}/users/42`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ id: "42" });
  });

  it("multi-param 캡처", async () => {
    const r = await fetch(`http://127.0.0.1:${handle.port}/a/foo/b/bar`);
    expect(await r.json()).toEqual({ x: "foo", y: "bar" });
  });

  it("같은 path 다른 method는 별개로 매칭", async () => {
    const get = await fetch(`http://127.0.0.1:${handle.port}/users/1`);
    expect(get.status).toBe(200);
    const post = await fetch(`http://127.0.0.1:${handle.port}/users`, { method: "POST" });
    expect(post.status).toBe(201);
  });

  it("미매칭 method도 404", async () => {
    const r = await fetch(`http://127.0.0.1:${handle.port}/users/1`, { method: "PUT" });
    expect(r.status).toBe(404);
  });

  it("query string은 path 매칭에 영향 없음, query에 분해", async () => {
    const r = await fetch(`http://127.0.0.1:${handle.port}/users/7?from=app&v=2`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ id: "7" });
  });

  it("204 No Content는 본문 없음", async () => {
    const r = await fetch(`http://127.0.0.1:${handle.port}/users/9`, { method: "DELETE" });
    expect(r.status).toBe(204);
    expect((await r.text()).length).toBe(0);
  });
});
