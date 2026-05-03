import { afterEach, describe, expect, it } from "vitest";
import { createApp, type AppHandle } from "../../../src/framework/app";

describe("middleware chain", () => {
  let handle: AppHandle;
  afterEach(async () => {
    await handle.close();
  });

  it("use 등록 순서대로 실행", async () => {
    const order: string[] = [];
    const app = createApp();
    app.use((_req, _res, next) => {
      order.push("a");
      next();
    });
    app.use((_req, _res, next) => {
      order.push("b");
      next();
    });
    app.get("/", (_req, res) => {
      order.push("h");
      res.text("ok");
    });
    handle = await app.listen({ port: 0 });

    const r = await fetch(`http://127.0.0.1:${handle.port}/`);
    expect(r.status).toBe(200);
    expect(order).toEqual(["a", "b", "h"]);
  });

  it("next 안 부르면 라우트 핸들러까지 가지 않음", async () => {
    const app = createApp();
    app.use((_req, res) => res.status(401).json({ error: "unauthorized" }));
    app.get("/", (_req, res) => res.text("hidden"));
    handle = await app.listen({ port: 0 });

    const r = await fetch(`http://127.0.0.1:${handle.port}/`);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: "unauthorized" });
  });

  it("동기 throw는 onError로 흡수", async () => {
    const app = createApp();
    app.get("/boom", () => {
      throw Object.assign(new Error("kaboom"), { status: 503 });
    });
    app.onError((err, _req, res) => {
      const e = err as { status?: number; message?: string };
      res.status(e.status ?? 500).json({ message: e.message });
    });
    handle = await app.listen({ port: 0 });

    const r = await fetch(`http://127.0.0.1:${handle.port}/boom`);
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ message: "kaboom" });
  });

  it("async rejection도 onError로 흡수", async () => {
    const app = createApp();
    app.get("/boom", async () => {
      throw new Error("async-boom");
    });
    app.onError((err, _req, res) => {
      res.status(500).json({ message: (err as Error).message });
    });
    handle = await app.listen({ port: 0 });

    const r = await fetch(`http://127.0.0.1:${handle.port}/boom`);
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ message: "async-boom" });
  });

  it("next(err)로도 onError 트리거", async () => {
    const app = createApp();
    app.use((_req, _res, next) => next(new Error("from-mw")));
    app.get("/", (_req, res) => res.text("never"));
    app.onError((err, _req, res) => res.status(500).json({ m: (err as Error).message }));
    handle = await app.listen({ port: 0 });

    const r = await fetch(`http://127.0.0.1:${handle.port}/`);
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ m: "from-mw" });
  });

  it("onError 미설정이면 기본 500 응답 (stack 노출 없이 message만)", async () => {
    const app = createApp();
    app.get("/", () => {
      throw new Error("default-handler");
    });
    handle = await app.listen({ port: 0 });

    const r = await fetch(`http://127.0.0.1:${handle.port}/`);
    expect(r.status).toBe(500);
    const body = (await r.json()) as { error: string };
    expect(body.error).toBe("default-handler");
    expect(body).not.toHaveProperty("stack");
  });
});
