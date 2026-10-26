import { describe, expect, it } from "vitest";
import { isDeviceName, sitePathSchema } from "./site-path.js";

const ok = (path: string) => sitePathSchema.safeParse(path).success;

describe("sitePathSchema", () => {
  it("takes relative, /-separated paths inside the site's folder", () => {
    expect(ok("index.html")).toBe(true);
    expect(ok("company/about-us.html")).toBe(true);
    expect(ok("assets/images/shop.webp")).toBe(true);
  });

  it("refuses paths that leave the folder, or name a drive, a stream or nothing", () => {
    for (const path of [
      "",
      "../x.html",
      "a/../../b",
      "./index.html",
      "/etc/passwd",
      "a//b",
      "a\\b",
      "C:\\x",
      "file.html:stream",
      "a\u0000b",
      "x".repeat(1025),
    ]) {
      expect(ok(path), JSON.stringify(path.slice(0, 20))).toBe(false);
    }
  });

  it("refuses Windows device names as a file or folder, in any case and with any extension", () => {
    for (const path of [
      "con.html",
      "aux/index.html",
      "NUL.html",
      "company/com1.html",
      "lpt9.tar.gz",
      "prn",
    ]) {
      expect(ok(path), path).toBe(false);
    }
    expect(ok("console.html")).toBe(true);
    expect(ok("com10.html")).toBe(true);
    expect(ok("contact/con-2.html")).toBe(true);
  });
});

describe("isDeviceName", () => {
  it("reads the name before the first dot, in any case", () => {
    expect(isDeviceName("con")).toBe(true);
    expect(isDeviceName("Com3.html")).toBe(true);
    expect(isDeviceName("cons")).toBe(false);
    expect(isDeviceName("com0")).toBe(false);
  });
});
