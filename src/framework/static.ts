import * as fs from "node:fs/promises";
import * as path from "node:path";
import { HttpParseError } from "../http/errors";
import type { Handler } from "./types";

/**
 * 학습 포인트:
 * - 정적 파일 서빙은 path traversal 공격(`../`로 root 밖 접근)을 막아야 한다.
 *   path.resolve로 절대경로화 → root 안에 있는지 확인하는 패턴.
 * - 디렉터리 listing은 정보 노출이라 비활성. 디렉터리 요청은 404.
 */

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

export interface StaticOptions {
  /** URL prefix. 기본 "/". */
  prefix?: string;
}

export function staticFiles(rootDir: string, opts: StaticOptions = {}): Handler {
  const root = path.resolve(rootDir);
  const prefix = opts.prefix ?? "/";

  return async (req, res, next) => {
    if (req.method.toUpperCase() !== "GET" && req.method.toUpperCase() !== "HEAD") {
      return next();
    }
    const reqPath = req.url.path;
    if (!reqPath.startsWith(prefix)) return next();

    const rel = reqPath.slice(prefix.length).replace(/^\/+/, "");
    const target = path.resolve(root, rel);

    // path traversal 차단: target이 root 안에 있어야 한다
    if (target !== root && !target.startsWith(root + path.sep)) {
      return next(new HttpParseError(400, "path traversal not allowed"));
    }

    try {
      const stat = await fs.stat(target);
      if (stat.isDirectory()) return next(); // 디렉터리는 미매칭
      const data = await fs.readFile(target);
      const ext = path.extname(target).toLowerCase();
      const ct = MIME[ext] ?? "application/octet-stream";
      res.set("Content-Type", ct);
      if (req.method.toUpperCase() === "HEAD") {
        res.set("Content-Length", String(data.length)).end();
      } else {
        res.send(data);
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") return next();
      next(err);
    }
  };
}
