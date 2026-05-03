import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { createApp, type AppHandle } from "../../../src/framework/app";
import { staticFiles } from "../../../src/framework/static";

describe("static files", () => {
  let handle: AppHandle;
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "my-http-static-"));
    await fs.writeFile(path.join(dir, "index.html"), "<h1>hi</h1>");
    await fs.mkdir(path.join(dir, "sub"), { recursive: true });
    await fs.writeFile(path.join(dir, "sub", "data.json"), JSON.stringify({ ok: true }));

    const app = createApp();
    app.use(staticFiles(dir));
    app.get("/api", (_req, res) => res.text("api"));
    app.onError((err, _req, res) => {
      const e = err as { status?: number; message?: string };
      res.status(e.status ?? 500).json({ error: e.message });
    });
    handle = await app.listen({ port: 0 });
  });

  afterEach(async () => {
    await handle.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("정상 파일 서빙 + content-type 추론", async () => {
    const r = await fetch(`http://127.0.0.1:${handle.port}/index.html`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/text\/html/);
    expect(await r.text()).toBe("<h1>hi</h1>");
  });

  it("하위 디렉터리 파일도 매칭", async () => {
    const r = await fetch(`http://127.0.0.1:${handle.port}/sub/data.json`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/application\/json/);
    expect(await r.json()).toEqual({ ok: true });
  });

  it("path traversal 시도는 400", async () => {
    // /etc/passwd 같은 곳을 노리는 시도
    const r = await fetch(
      `http://127.0.0.1:${handle.port}/../../../../../../etc/passwd`,
      { redirect: "manual" },
    );
    // fetch가 ../을 normalize할 수 있어 실제로는 raw socket으로 시도하는 게 정확하지만
    // 여기선 normalize 결과가 "/etc/passwd"가 되어도 그냥 404가 나야 한다.
    expect([400, 404]).toContain(r.status);
  });

  it("없는 파일은 다른 라우트로 fallthrough → 결국 404", async () => {
    const r = await fetch(`http://127.0.0.1:${handle.port}/missing.html`);
    expect(r.status).toBe(404);
  });

  it("등록된 라우트가 더 우선 — /api는 정적 파일이 아닌 핸들러로", async () => {
    const r = await fetch(`http://127.0.0.1:${handle.port}/api`);
    expect(await r.text()).toBe("api");
  });

  it("디렉터리 자체는 fallthrough (listing 비활성)", async () => {
    const r = await fetch(`http://127.0.0.1:${handle.port}/sub`);
    expect(r.status).toBe(404);
  });
});

describe("static — raw socket으로 진짜 traversal 시도", () => {
  let handle: AppHandle;
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "my-http-static-"));
    await fs.writeFile(path.join(dir, "ok.txt"), "ok");

    const app = createApp();
    app.use(staticFiles(dir));
    app.onError((err, _req, res) => {
      const e = err as { status?: number; message?: string };
      res.status(e.status ?? 500).json({ error: e.message });
    });
    handle = await app.listen({ port: 0 });
  });

  afterEach(async () => {
    await handle.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("raw GET /../etc/passwd → 400", async () => {
    const net = await import("node:net");
    const result = await new Promise<string>((resolve, reject) => {
      const socket = net.createConnection({ port: handle.port, host: "127.0.0.1" });
      let buf = "";
      socket.on("connect", () => {
        socket.write("GET /../etc/passwd HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n");
      });
      socket.on("data", (c: Buffer) => (buf += c.toString("utf8")));
      socket.on("close", () => resolve(buf));
      socket.on("error", reject);
    });
    expect(result.startsWith("HTTP/1.1 400")).toBe(true);
  });
});
