import { describe, expect, it } from "vitest";
import { parseStatusLine } from "../../../src/http/parse-status-line";
import { HttpParseError } from "../../../src/http/errors";

describe("parseStatusLine", () => {
  it("표준 200 OK", () => {
    expect(parseStatusLine("HTTP/1.1 200 OK")).toEqual({
      httpVersion: "HTTP/1.1",
      statusCode: 200,
      reasonPhrase: "OK",
    });
  });

  it("reason-phrase 생략 허용", () => {
    expect(parseStatusLine("HTTP/1.1 204 ")).toEqual({
      httpVersion: "HTTP/1.1",
      statusCode: 204,
      reasonPhrase: "",
    });
  });

  it("reason-phrase 자체 없음 (SP 없음)도 허용", () => {
    expect(parseStatusLine("HTTP/1.1 204")).toEqual({
      httpVersion: "HTTP/1.1",
      statusCode: 204,
      reasonPhrase: "",
    });
  });

  it("reason-phrase에 공백 포함", () => {
    expect(parseStatusLine("HTTP/1.1 404 Not Found").reasonPhrase).toBe("Not Found");
  });

  it("status code 자릿수 다르면 400", () => {
    expect(() => parseStatusLine("HTTP/1.1 20 OK")).toThrow(HttpParseError);
    expect(() => parseStatusLine("HTTP/1.1 2000 OK")).toThrow(HttpParseError);
  });

  it("HTTP-version 누락은 400", () => {
    expect(() => parseStatusLine("200 OK")).toThrow(HttpParseError);
  });

  it("HTTP/0.9는 505", () => {
    try {
      parseStatusLine("HTTP/0.9 200 OK");
      expect.fail("should throw");
    } catch (err) {
      expect((err as HttpParseError).status).toBe(505);
    }
  });
});
