import { describe, expect, it } from "vitest";
import { sitePathSchema } from "./site-path.js";

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
});
