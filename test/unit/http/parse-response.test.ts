import { describe, expect, it } from "vitest";
import {
  HttpResponseParser,
  parseResponse,
} from "../../../src/http/parser";
import { getHeader } from "../../../src/http/types";

const CRLF = "\r\n";
const buf = (...lines: string[]) => Buffer.from(lines.join(CRLF));

describe("HttpResponseParser", () => {
  it("body 없는 단순 200", () => {
    const r = parseResponse(buf("HTTP/1.1 200 OK", "Content-Length: 0", "", ""));
    expect(r.statusCode).toBe(200);
    expect(r.reasonPhrase).toBe("OK");
    expect(r.body.length).toBe(0);
  });

  it("Content-Length body", () => {
    const body = "{\"ok\":true}";
    const r = parseResponse(
      Buffer.concat([
        buf(
          "HTTP/1.1 200 OK",
          "Content-Type: application/json",
          `Content-Length: ${body.length}`,
          "",
          "",
        ),
        Buffer.from(body),
      ]),
    );
    expect(r.body.toString("utf8")).toBe(body);
    expect(getHeader(r.headers, "content-type")).toBe("application/json");
  });

  it("chunked body + 1 byte streaming", () => {
    const raw = buf(
      "HTTP/1.1 200 OK",
      "Transfer-Encoding: chunked",
      "",
      "5",
      "hello",
      "0",
      "",
      "",
    );
    const p = new HttpResponseParser();
    for (let i = 0; i < raw.length; i++) p.feed(raw.subarray(i, i + 1));
    const r = p.next();
    expect(r?.body.toString("utf8")).toBe("hello");
  });

  it("204 reason-phrase 없는 응답", () => {
    const r = parseResponse(buf("HTTP/1.1 204", "Content-Length: 0", "", ""));
    expect(r.statusCode).toBe(204);
    expect(r.reasonPhrase).toBe("");
  });
});
