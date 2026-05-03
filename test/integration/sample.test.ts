import { describe, it, expect } from "vitest";

describe("integration sample", () => {
  it("concatenates strings", () => {
    expect("my" + "-http").toBe("my-http");
  });
});
