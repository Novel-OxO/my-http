import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { createApp } from "./app";
import { json } from "./body-parsers";
import { staticFiles } from "./static";
import { log } from "../tcp/log";

/**
 * Express-like 데모 앱. 4개 라우트 + 미들웨어 + 정적 파일.
 *
 *   pnpm start framework
 *   curl -i http://127.0.0.1:3000/
 *   curl -i http://127.0.0.1:3000/users/42
 *   curl -i -XPOST -H 'content-type: application/json' -d '{"name":"al"}' \
 *        http://127.0.0.1:3000/users
 *   curl -i http://127.0.0.1:3000/static/hello.txt
 */
export async function runFrameworkDemo(): Promise<void> {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "127.0.0.1";

  // 데모용 정적 디렉터리 생성
  const staticDir = await fs.mkdtemp(path.join(os.tmpdir(), "my-http-demo-"));
  await fs.writeFile(path.join(staticDir, "hello.txt"), "static hello!\n");

  const app = createApp();
  app.use(json());
  app.use(staticFiles(staticDir, { prefix: "/static" }));

  app.get("/", (_req, res) => res.text("hello from my-http framework"));

  app.get("/users/:id", (req, res) => {
    res.json({ id: req.params.id, query: req.query });
  });

  app.post("/users", (req, res) => {
    res.status(201).json({ created: true, body: req.body });
  });

  app.onError((err, _req, res) => {
    const e = err as { status?: number; message?: string };
    if (res.headersSent) return;
    res.status(e.status ?? 500).json({ error: e.message ?? "Internal Server Error" });
  });

  const handle = await app.listen({ port, host });
  log.info(`demo: try curl -i http://${handle.host}:${handle.port}/`);
  log.info(`static dir: ${staticDir}`);

  let shuttingDown = false;
  const onSignal = (sig: NodeJS.Signals) => {
    if (shuttingDown) {
      log.info(`${sig} again — forcing exit`);
      process.exit(1);
    }
    shuttingDown = true;
    log.info(`${sig} received — graceful shutdown`);
    handle.close().then(() => log.info("shutdown complete"));
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  await new Promise<void>((resolve) => handle.server.once("close", resolve));
  await fs.rm(staticDir, { recursive: true, force: true });
}
