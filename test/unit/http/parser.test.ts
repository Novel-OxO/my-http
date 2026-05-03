import { describe, expect, it } from "vitest";
import {
  HttpRequestParser,
  parseRequest,
} from "../../../src/http/parser";
import { getHeader } from "../../../src/http/types";
import { HttpParseError } from "../../../src/http/errors";

const CRLF = "\r\n";

function buf(...lines: string[]): Buffer {
  return Buffer.from(lines.join(CRLF));
}

describe("HttpRequestParser - basic", () => {
  it("body 없는 단순 GET 요청", () => {
    const req = parseRequest(buf("GET / HTTP/1.1", "Host: example.com", "", ""));
    expect(req.method).toBe("GET");
    expect(req.target).toBe("/");
    expect(req.body.length).toBe(0);
    expect(getHeader(req.headers, "host")).toBe("example.com");
  });

  it("Content-Length body 정확히 N byte 수집", () => {
    const body = "hello world";
    const req = parseRequest(
      Buffer.concat([
        buf("POST /echo HTTP/1.1", "Host: a", `Content-Length: ${body.length}`, "", ""),
        Buffer.from(body),
      ]),
    );
    expect(req.body.toString("utf8")).toBe(body);
  });

  it("Content-Length 0이면 즉시 완료", () => {
    const req = parseRequest(buf("POST / HTTP/1.1", "Host: a", "Content-Length: 0", "", ""));
    expect(req.body.length).toBe(0);
  });
});

describe("HttpRequestParser - chunked body", () => {
  it("단순 chunked body 디코드", () => {
    const raw = Buffer.from(
      [
        "POST / HTTP/1.1",
        "Host: a",
        "Transfer-Encoding: chunked",
        "",
        "5",
        "hello",
        "6",
        " world",
        "0",
        "",
        "",
      ].join(CRLF),
    );
    const req = parseRequest(raw);
    expect(req.body.toString("utf8")).toBe("hello world");
  });

  it("chunk extension은 무시한다", () => {
    const raw = Buffer.from(
      [
        "POST / HTTP/1.1",
        "Host: a",
        "Transfer-Encoding: chunked",
        "",
        "5;name=value",
        "hello",
        "0",
        "",
        "",
      ].join(CRLF),
    );
    const req = parseRequest(raw);
    expect(req.body.toString("utf8")).toBe("hello");
  });

  it("trailer 헤더를 인식한다", () => {
    const raw = Buffer.from(
      [
        "POST / HTTP/1.1",
        "Host: a",
        "Transfer-Encoding: chunked",
        "Trailer: X-After",
        "",
        "3",
        "abc",
        "0",
        "X-After: done",
        "",
        "",
      ].join(CRLF),
    );
    const req = parseRequest(raw);
    expect(req.body.toString("utf8")).toBe("abc");
    expect(req.trailers).toEqual([["X-After", "done"]]);
  });
});

describe("HttpRequestParser - streaming", () => {
  it("1 byte씩 흘려도 정상 파싱", () => {
    const raw = Buffer.from(
      [
        "POST /x HTTP/1.1",
        "Host: a",
        "Content-Length: 5",
        "",
        "abcde",
      ].join(CRLF),
    );
    const p = new HttpRequestParser();
    for (let i = 0; i < raw.length; i++) {
      p.feed(raw.subarray(i, i + 1));
    }
    const msg = p.next();
    expect(msg).not.toBeNull();
    expect(msg!.body.toString("utf8")).toBe("abcde");
  });

  it("chunked도 1 byte씩 흘려도 정상", () => {
    const raw = Buffer.from(
      [
        "POST / HTTP/1.1",
        "Host: a",
        "Transfer-Encoding: chunked",
        "",
        "5",
        "hello",
        "0",
        "",
        "",
      ].join(CRLF),
    );
    const p = new HttpRequestParser();
    for (let i = 0; i < raw.length; i++) p.feed(raw.subarray(i, i + 1));
    const msg = p.next();
    expect(msg!.body.toString("utf8")).toBe("hello");
  });

  it("pipelining: 한 buffer에 두 요청이 연속", () => {
    const raw = Buffer.concat([
      buf("GET /a HTTP/1.1", "Host: a", "", ""),
      buf("GET /b HTTP/1.1", "Host: b", "", ""),
    ]);
    const p = new HttpRequestParser();
    p.feed(raw);
    const a = p.next();
    const b = p.next();
    expect(a?.target).toBe("/a");
    expect(b?.target).toBe("/b");
    expect(p.next()).toBeNull();
  });
});

describe("HttpRequestParser - errors", () => {
  it("Content-Length와 Transfer-Encoding 동시 등장은 400", () => {
    const raw = buf(
      "POST / HTTP/1.1",
      "Host: a",
      "Content-Length: 5",
      "Transfer-Encoding: chunked",
      "",
      "",
    );
    expect(() => parseRequest(raw)).toThrow(HttpParseError);
  });

  it("잘못된 chunk size는 400", () => {
    const raw = Buffer.from(
      [
        "POST / HTTP/1.1",
        "Host: a",
        "Transfer-Encoding: chunked",
        "",
        "ZZZ",
        "",
      ].join(CRLF),
    );
    expect(() => parseRequest(raw)).toThrow(HttpParseError);
  });

  it("Content-Length 음수/비숫자는 400", () => {
    const raw = buf("POST / HTTP/1.1", "Host: a", "Content-Length: abc", "", "");
    expect(() => parseRequest(raw)).toThrow(HttpParseError);
  });

  it("불완전 메시지는 incomplete로 throw", () => {
    expect(() => parseRequest(Buffer.from("GET / HTTP/1.1\r\n"))).toThrow();
  });
});
