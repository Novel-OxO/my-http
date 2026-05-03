import * as net from "node:net";
import { HttpRequestParser } from "../http/parser";
import { HttpParseError } from "../http/errors";
import { getHeader, type HttpRequest } from "../http/types";
import { log } from "../tcp/log";
import { HttpResponseBuilder } from "./response";
import { parseRequestTarget } from "./url";
import type {
  ErrorHandler,
  FwRequest,
  Handler,
  ResponseBuilder,
} from "./types";

/**
 * 미니 프레임워크의 진입점.
 *
 * 학습 포인트:
 * - TCP 소켓 → HttpRequestParser → handler → 직렬화 → 소켓 write의 단방향 흐름.
 * - 한 소켓에서 parser.next()가 메시지를 반환할 때마다 핸들러를 호출 (keep-alive).
 *   소켓을 닫는 책임은 응답 보낸 뒤 keep-alive 여부에 따라 결정한다.
 */

export interface AppOptions {
  /** keep-alive 활성 시 idle 타임아웃 (ms). 기본 5초. */
  keepAliveTimeoutMs?: number;
}

export interface ListenOptions {
  port?: number;
  host?: string;
}

export interface AppHandle {
  server: net.Server;
  port: number;
  host: string;
  close: () => Promise<void>;
}

type Route = {
  method: string;
  matcher: RegExp;
  paramNames: string[];
  handler: Handler;
};

type UseEntry = { path: string; handler: Handler };

export interface App {
  use(handler: Handler): App;
  use(path: string, handler: Handler): App;
  get(path: string, handler: Handler): App;
  post(path: string, handler: Handler): App;
  put(path: string, handler: Handler): App;
  patch(path: string, handler: Handler): App;
  delete(path: string, handler: Handler): App;
  head(path: string, handler: Handler): App;
  options(path: string, handler: Handler): App;
  onError(handler: ErrorHandler): App;
  listen(opts?: ListenOptions): Promise<AppHandle>;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

export function createApp(options: AppOptions = {}): App {
  const middlewares: UseEntry[] = [];
  const routes: Route[] = [];
  let errorHandler: ErrorHandler = defaultErrorHandler;

  const app: App = {
    use(pathOrHandler: string | Handler, maybeHandler?: Handler) {
      if (typeof pathOrHandler === "string") {
        if (!maybeHandler) throw new Error("use(path, handler): handler required");
        middlewares.push({ path: pathOrHandler, handler: maybeHandler });
      } else {
        middlewares.push({ path: "/", handler: pathOrHandler });
      }
      return app;
    },
    get: (p, h) => addRoute("GET", p, h),
    post: (p, h) => addRoute("POST", p, h),
    put: (p, h) => addRoute("PUT", p, h),
    patch: (p, h) => addRoute("PATCH", p, h),
    delete: (p, h) => addRoute("DELETE", p, h),
    head: (p, h) => addRoute("HEAD", p, h),
    options: (p, h) => addRoute("OPTIONS", p, h),
    onError(handler) {
      errorHandler = handler;
      return app;
    },
    listen: (opts = {}) => listen(opts),
  };

  function addRoute(method: string, path: string, handler: Handler): App {
    const compiled = compilePath(path);
    routes.push({ method, ...compiled, handler });
    return app;
  }

  async function listen(opts: ListenOptions): Promise<AppHandle> {
    const host = opts.host ?? "127.0.0.1";
    const port = opts.port ?? 3000;
    const keepAliveTimeoutMs = options.keepAliveTimeoutMs ?? 5000;

    const activeSockets = new Set<net.Socket>();

    const server = net.createServer((socket) => {
      activeSockets.add(socket);
      socket.setTimeout(keepAliveTimeoutMs);
      socket.on("timeout", () => socket.end());
      socket.on("close", () => activeSockets.delete(socket));
      socket.on("error", (err) => log.debug(`socket error: ${err.message}`));

      const parser = new HttpRequestParser();
      let processing: Promise<void> = Promise.resolve();

      socket.on("data", (chunk: Buffer) => {
        try {
          parser.feed(chunk);
        } catch (err) {
          // 파서 에러는 즉시 4xx 응답하고 연결 종료
          processing = processing.then(() => writeParseError(socket, err));
          return;
        }
        processing = processing.then(() => drainAndHandle(socket, parser));
      });
      socket.on("end", () => {
        // 클라이언트가 FIN을 보내면 더 이상 요청은 없다. 진행 중인 응답이 끝나면 close.
        processing.finally(() => socket.end());
      });
    });

    async function drainAndHandle(socket: net.Socket, parser: HttpRequestParser): Promise<void> {
      while (true) {
        const msg = parser.next();
        if (!msg) return;
        await handleOne(socket, msg);
      }
    }

    async function handleOne(socket: net.Socket, msg: HttpRequest): Promise<void> {
      const keepAlive = decideKeepAlive(msg);
      let responseSent = false;
      const builder = new HttpResponseBuilder({
        send: (buf) => {
          responseSent = true;
          socket.write(buf);
        },
        shouldKeepAlive: keepAlive,
      });

      const req = toFwRequest(msg);
      try {
        await runChain(req, builder);
      } catch (err) {
        await safeError(err, req, builder);
      }

      // 핸들러가 응답 안 했으면 404 (라우트 없음) 또는 미들웨어 누락
      if (!responseSent && !builder.headersSent) {
        builder.status(404).json({ error: "Not Found" });
      }

      if (!keepAlive) {
        // 응답 flush 후 한 틱 양보 후 close
        socket.end();
      }
    }

    async function runChain(req: FwRequest, res: ResponseBuilder): Promise<void> {
      const chain: Handler[] = [];
      for (const m of middlewares) {
        if (pathMatches(m.path, req.url.path)) chain.push(m.handler);
      }
      const route = routes.find(
        (r) => r.method === req.method.toUpperCase() && r.matcher.test(req.url.path),
      );
      if (route) {
        const m = route.matcher.exec(req.url.path);
        if (m) {
          for (let i = 0; i < route.paramNames.length; i++) {
            req.params[route.paramNames[i]] = m[i + 1] ?? "";
          }
        }
        chain.push(route.handler);
      }
      await runMiddlewareChain(chain, req, res);
    }

    async function safeError(err: unknown, req: FwRequest, res: ResponseBuilder): Promise<void> {
      try {
        await errorHandler(err, req, res);
      } catch (handlerErr) {
        log.error(handlerErr);
        if (!res.headersSent) {
          res.status(500).json({ error: "Internal Server Error" });
        }
      }
    }

    return new Promise<AppHandle>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, () => {
        server.removeListener("error", reject);
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          reject(new Error("unexpected server address"));
          return;
        }
        log.info(`framework listening on ${addr.address}:${addr.port}`);
        resolve({
          server,
          port: addr.port,
          host: addr.address,
          close: async () => {
            const closed = new Promise<void>((res, rej) => {
              server.close((err) => (err ? rej(err) : res()));
            });
            for (const s of activeSockets) s.end();
            await closed;
            while (activeSockets.size > 0) {
              await new Promise<void>((r) => setImmediate(r));
            }
          },
        });
      });
    });
  }

  return app;
}

function defaultErrorHandler(err: unknown, _req: FwRequest, res: ResponseBuilder): void {
  if (res.headersSent) return;
  const status =
    err instanceof HttpParseError
      ? err.status
      : (err as { status?: number } | null)?.status ?? 500;
  // stack 노출 금지 — 학습 디폴트
  const message = err instanceof Error ? err.message : "Internal Server Error";
  res.status(status).json({ error: message });
}

async function runMiddlewareChain(
  chain: Handler[],
  req: FwRequest,
  res: ResponseBuilder,
): Promise<void> {
  /**
   * 학습 포인트: Express식 미들웨어 체인의 종료 시점.
   * - 핸들러가 next()를 부르면 다음 미들웨어로 진행.
   * - 핸들러가 next()를 안 부르고 (sync) 반환하면 체인 종료.
   * - 핸들러가 promise를 반환하면 그 promise resolve 시점에 next 호출 여부로 판단.
   */
  return new Promise<void>((resolve, reject) => {
    const dispatch = (idx: number): void => {
      const handler = chain[idx];
      if (!handler) return resolve();

      let calledNext = false;
      let settled = false;
      const next = (err?: unknown) => {
        if (settled) return; // 두 번 호출 방지
        settled = true;
        if (err) return reject(err);
        calledNext = true;
        dispatch(idx + 1);
      };

      let ret: unknown;
      try {
        ret = handler(req, res, next);
      } catch (e) {
        if (!settled) {
          settled = true;
          return reject(e);
        }
        return;
      }

      if (ret && typeof (ret as { then?: unknown }).then === "function") {
        (ret as Promise<unknown>).then(
          () => {
            if (!calledNext && !settled) {
              settled = true;
              resolve();
            }
          },
          (e) => {
            if (!settled) {
              settled = true;
              reject(e);
            }
          },
        );
      } else {
        // sync 반환: next를 안 불렀다면 체인 종료
        if (!calledNext && !settled) {
          settled = true;
          resolve();
        }
      }
    };
    dispatch(0);
  });
}

function decideKeepAlive(req: HttpRequest): boolean {
  const conn = (getHeader(req.headers, "connection") ?? "").toLowerCase();
  if (req.httpVersion === "HTTP/1.0") {
    return conn === "keep-alive";
  }
  // HTTP/1.1 default keep-alive
  return conn !== "close";
}

function toFwRequest(msg: HttpRequest): FwRequest {
  const parsed = parseRequestTarget(msg.target);
  return {
    method: msg.method,
    target: msg.target,
    httpVersion: msg.httpVersion,
    headers: msg.headers,
    rawBody: msg.body,
    body: msg.body,
    params: {},
    query: parsed.queryParams,
    url: { path: parsed.path, query: parsed.query },
    raw: msg,
  };
}

function compilePath(path: string): { matcher: RegExp; paramNames: string[] } {
  /**
   * 학습 포인트: 라우트 매칭 — 정규식 컴파일.
   * 단순 split은 구현이 쉽지만 prefix 매칭(`*`)이나 optional segment를 다루기 어렵다.
   * 학습용으로 :param만 지원하고 나머지는 정확 매칭.
   */
  const paramNames: string[] = [];
  const segments = path.split("/").map((seg) => {
    if (seg.startsWith(":")) {
      paramNames.push(seg.slice(1));
      return "([^/]+)";
    }
    return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });
  const re = new RegExp("^" + segments.join("/") + "$");
  return { matcher: re, paramNames };
}

function pathMatches(prefix: string, requestPath: string): boolean {
  if (prefix === "/" || prefix === "") return true;
  if (requestPath === prefix) return true;
  return requestPath.startsWith(prefix + "/");
}

function writeParseError(socket: net.Socket, err: unknown): void {
  const status = err instanceof HttpParseError ? err.status : 400;
  const body = JSON.stringify({ error: err instanceof Error ? err.message : "bad request" });
  const head =
    `HTTP/1.1 ${status} ${status === 400 ? "Bad Request" : "Error"}\r\n` +
    `Content-Type: application/json; charset=utf-8\r\n` +
    `Content-Length: ${Buffer.byteLength(body)}\r\n` +
    `Connection: close\r\n\r\n`;
  socket.write(head + body);
  socket.end();
}

// 사용 안 하는 METHODS export 방지용 internal 참조
void METHODS;
