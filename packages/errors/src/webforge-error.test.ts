import { describe, expect, it } from "vitest";
import { errnoOf, errorCode, WebforgeError } from "./webforge-error.js";

class TestError extends WebforgeError<"broken" | "gone"> {
  override readonly name = "TestError";

  constructor(code: "broken" | "gone", options?: ErrorOptions) {
    super(code, `C:\\Users\\someone\\Site.wforge is ${code}`, options);
  }
}

describe("WebforgeError (standards §4)", () => {
  it("carries a code and a cause", () => {
    const cause = new Error("disk");
    const error = new TestError("broken", { cause });

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ name: "TestError", code: "broken" });
    expect(error.cause).toBe(cause);
  });
});

describe("errorCode", () => {
  it("gives a Webforge error's name and code, never its message", () => {
    const code = errorCode(new TestError("gone"));

    expect(code).toBe("TestError gone");
    expect(code).not.toContain("Users");
  });

  it("gives Node's and SQLite's codes, and a name alone without one", () => {
    const missing = Object.assign(new Error("ENOENT: no such file, open '/home/me/x'"), {
      code: "ENOENT",
    });
    const busy = Object.assign(new Error("database is locked"), {
      name: "SqliteError",
      code: "SQLITE_BUSY",
    });

    expect(errorCode(missing)).toBe("Error ENOENT");
    expect(errorCode(busy)).toBe("SqliteError SQLITE_BUSY");
    expect(errorCode(new TypeError("x is not a function"))).toBe("TypeError");
  });

  it("leaves out a name or code that could carry data, and says only the type of a non-error", () => {
    const odd = Object.assign(new Error("x"), { name: "Bad name /home/me", code: 42 });
    const pathCode = Object.assign(new Error("x"), { code: "/home/me/site.wforge" });

    expect(errorCode(odd)).toBe("Error");
    expect(errorCode(pathCode)).toBe("Error");
    expect(errorCode("Failed for /home/me")).toBe("string");
    expect(errorCode({ message: "secret" })).toBe("object");
    expect(errorCode(null)).toBe("null");
    expect(errorCode(undefined)).toBe("undefined");
  });
});

describe("errnoOf (#989)", () => {
  it("gives a Node error's system code", () => {
    expect(errnoOf(Object.assign(new Error("gone"), { code: "ENOENT" }))).toBe("ENOENT");
  });

  it("gives nothing for an error without a string code, or for what isn't an error", () => {
    expect(errnoOf(new Error("plain"))).toBeUndefined();
    expect(errnoOf(Object.assign(new Error("odd"), { code: 5 }))).toBeUndefined();
    expect(errnoOf({ code: "ENOENT" })).toBeUndefined();
    expect(errnoOf("ENOENT")).toBeUndefined();
    expect(errnoOf(null)).toBeUndefined();
  });
});
