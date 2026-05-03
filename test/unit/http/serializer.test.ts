import { describe, expect, it } from "vitest";
import {
  serializeRequest,
  serializeResponse,
} from "../../../src/http/serializer";
import { parseRequest, parseResponse } from "../../../src/http/parser";
import { HttpParseError } from "../../../src/http/errors";

describe("serialize / round-trip", () => {
  it("request: serialize → parse 동치 (Content-Length 자동)", () => {
    const out = serializeRequest({
      method: "POST",
      target: "/users",
      httpVersion: "HTTP/1.1",
      headers: [["Host", "example.com"], ["Content-Type", "application/json"]],
      body: Buffer.from("{\"name\":\"a\"}"),
    });
    const expectedCL = Buffer.byteLength("{\"name\":\"a\"}").toString();
    expect(out.toString("utf8")).toContain(`Content-Length: ${expectedCL}`);
    const reparsed = parseRequest(out);
    expect(reparsed.method).toBe("POST");
    expect(reparsed.target).toBe("/users");
    expect(reparsed.body.toString("utf8")).toBe("{\"name\":\"a\"}");
  });

  it("request chunked 옵션: TE 헤더 추가 + chunked 인코딩", () => {
    const body = Buffer.from("hello world");
    const out = serializeRequest(
      {
        method: "POST",
        target: "/",
        httpVersion: "HTTP/1.1",
        headers: [["Host", "a"]],
        body,
      },
      { chunked: true },
    );
    expect(out.toString("utf8")).toContain("Transfer-Encoding: chunked");
    const reparsed = parseRequest(out);
    expect(reparsed.body.toString("utf8")).toBe("hello world");
  });

  it("response: serialize → parse 동치 (Content-Length 자동)", () => {
    const out = serializeResponse({
      httpVersion: "HTTP/1.1",
      statusCode: 200,
      reasonPhrase: "OK",
      headers: [["Content-Type", "text/plain"]],
      body: Buffer.from("hi"),
    });
    const reparsed = parseResponse(out);
    expect(reparsed.statusCode).toBe(200);
    expect(reparsed.body.toString("utf8")).toBe("hi");
  });

  it("response: reason-phrase 빈 문자열도 round-trip", () => {
    const out = serializeResponse({
      httpVersion: "HTTP/1.1",
      statusCode: 204,
      reasonPhrase: "",
      headers: [],
      body: Buffer.alloc(0),
    });
    const reparsed = parseResponse(out);
    expect(reparsed.statusCode).toBe(204);
    expect(reparsed.reasonPhrase).toBe("");
    expect(reparsed.body.length).toBe(0);
  });

  it("사용자가 명시한 Content-Length는 그대로 유지", () => {
    const out = serializeRequest({
      method: "GET",
      target: "/",
      httpVersion: "HTTP/1.1",
      headers: [["Host", "a"], ["Content-Length", "0"]],
      body: Buffer.alloc(0),
    });
    const text = out.toString("utf8");
    // Content-Length가 한 번만 등장
    expect(text.match(/Content-Length:/g)?.length).toBe(1);
  });

  it("잘못된 method는 직렬화 단계에서 reject", () => {
    expect(() =>
      serializeRequest({
        method: "BAD METHOD",
        target: "/",
        httpVersion: "HTTP/1.1",
        headers: [],
        body: Buffer.alloc(0),
      }),
    ).toThrow(HttpParseError);
  });

  it("chunked 옵션과 Content-Length 동시 지정 reject", () => {
    expect(() =>
      serializeRequest(
        {
          method: "POST",
          target: "/",
          httpVersion: "HTTP/1.1",
          headers: [["Host", "a"], ["Content-Length", "5"]],
          body: Buffer.from("hello"),
        },
        { chunked: true },
      ),
    ).toThrow(HttpParseError);
  });

  it("status code 범위 밖 reject", () => {
    expect(() =>
      serializeResponse({
        httpVersion: "HTTP/1.1",
        statusCode: 99,
        reasonPhrase: "x",
        headers: [],
        body: Buffer.alloc(0),
      }),
    ).toThrow(HttpParseError);
  });
});
