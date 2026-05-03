import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, type AppHandle } from "../../../src/framework/app";

describe("framework basic server", () => {
  let handle: AppHandle;

  beforeEach(async () => {
    const app = createApp();
    app.get("/", (_req, res) => res.text("hello"));
    handle = await app.listen({ port: 0, host: "127.0.0.1" });
  });

  afterEach(async () => {
    await handle.close();
  });

  it("GET / returns 'hello' with text/plain", async () => {
    const r = await fetch(`http://127.0.0.1:${handle.port}/`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/text\/plain/);
    expect(await r.text()).toBe("hello");
  });

  it("매칭되지 않는 경로는 404", async () => {
    const r = await fetch(`http://127.0.0.1:${handle.port}/nope`);
    expect(r.status).toBe(404);
  });
});
