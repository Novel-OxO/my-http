import { HttpParseError } from "../http/errors";
import { getHeader } from "../http/types";
import type { Handler } from "./types";

/**
 * 학습 포인트:
 * - body parser는 미들웨어다. content-type을 보고 매칭될 때만 디코드.
 * - 크기 제한은 인터넷 노출 시 필수 — DoS 예방. 초과 시 413 권장.
 * - 라우트는 이미 raw body Buffer를 갖고 있어서, parser는 req.body를 디코드된 값으로 대체.
 */

const DEFAULT_LIMIT = 1024 * 1024; // 1MB

export interface BodyParserOptions {
  limit?: number;
}

export function json(opts: BodyParserOptions = {}): Handler {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  return (req, _res, next) => {
    const ct = getHeader(req.headers, "content-type") ?? "";
    if (!/^application\/json\b/.test(ct)) {
      return next();
    }
    if (req.rawBody.length > limit) {
      return next(new HttpParseError(413, "json body too large"));
    }
    if (req.rawBody.length === 0) {
      req.body = undefined;
      return next();
    }
    try {
      req.body = JSON.parse(req.rawBody.toString("utf8"));
    } catch (err) {
      return next(new HttpParseError(400, `invalid JSON: ${(err as Error).message}`));
    }
    next();
  };
}

export function urlencoded(opts: BodyParserOptions = {}): Handler {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  return (req, _res, next) => {
    const ct = getHeader(req.headers, "content-type") ?? "";
    if (!/^application\/x-www-form-urlencoded\b/.test(ct)) {
      return next();
    }
    if (req.rawBody.length > limit) {
      return next(new HttpParseError(413, "urlencoded body too large"));
    }
    const out: Record<string, string> = {};
    if (req.rawBody.length === 0) {
      req.body = out;
      return next();
    }
    for (const pair of req.rawBody.toString("utf8").split("&")) {
      if (!pair) continue;
      const eq = pair.indexOf("=");
      const k = eq < 0 ? pair : pair.slice(0, eq);
      const v = eq < 0 ? "" : pair.slice(eq + 1);
      try {
        out[decodeURIComponent(k.replace(/\+/g, " "))] = decodeURIComponent(v.replace(/\+/g, " "));
      } catch {
        return next(new HttpParseError(400, "malformed urlencoded body"));
      }
    }
    req.body = out;
    next();
  };
}
