import { describe, expect, it } from "vitest";
import { parseRequestLine } from "../../../src/http/parse-request-line";
import { HttpParseError } from "../../../src/http/errors";

describe("parseRequestLine", () => {
  it("표준 GET 요청 라인", () => {
    expect(parseRequestLine("GET / HTTP/1.1")).toEqual({
      method: "GET",
      target: "/",
      httpVersion: "HTTP/1.1",
    });
  });

  it("토큰이면 lowercase method도 보존된다", () => {
    expect(parseRequestLine("post /users HTTP/1.1").method).toBe("post");
  });

  it("HTTP/1.0도 허용", () => {
    expect(parseRequestLine("GET / HTTP/1.0").httpVersion).toBe("HTTP/1.0");
  });

  it("query string과 fragment-less target 보존", () => {
    expect(parseRequestLine("GET /a/b?x=1&y=2 HTTP/1.1").target).toBe("/a/b?x=1&y=2");
  });

  it("빈 줄은 400", () => {
    expect(() => parseRequestLine("")).toThrow(HttpParseError);
  });

  it("SP 누락은 400", () => {
    expect(() => parseRequestLine("GET/ HTTP/1.1")).toThrow(HttpParseError);
    expect(() => parseRequestLine("GET /")).toThrow(HttpParseError);
  });

  it("method가 토큰이 아니면 400", () => {
    expect(() => parseRequestLine("GE T / HTTP/1.1")).toThrow(HttpParseError);
    expect(() => parseRequestLine("\"GET\" / HTTP/1.1")).toThrow(HttpParseError);
  });

  it("HTTP/0.9는 505", () => {
    try {
      parseRequestLine("GET / HTTP/0.9");
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpParseError);
      expect((err as HttpParseError).status).toBe(505);
    }
  });

  it("HTTP/2는 505", () => {
    try {
      parseRequestLine("GET / HTTP/2.0");
      expect.fail("should throw");
    } catch (err) {
      expect((err as HttpParseError).status).toBe(505);
    }
  });

  it("malformed version은 400", () => {
    try {
      parseRequestLine("GET / HTTP/1");
      expect.fail("should throw");
    } catch (err) {
      expect((err as HttpParseError).status).toBe(400);
    }
  });

  it("target이 비어 있으면 400", () => {
    expect(() => parseRequestLine("GET  HTTP/1.1")).toThrow(HttpParseError);
  });

  it("여분 공백은 400", () => {
    expect(() => parseRequestLine("GET / HTTP/1.1 extra")).toThrow(HttpParseError);
  });

  it("target에 CTL이 있으면 400", () => {
    expect(() => parseRequestLine("GET /\x00 HTTP/1.1")).toThrow(HttpParseError);
    expect(() => parseRequestLine("GET /\x7f HTTP/1.1")).toThrow(HttpParseError);
  });
});
