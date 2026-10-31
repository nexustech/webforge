import { describe, expect, it } from "vitest";
import { safeFileName } from "./file-names.js";

describe("safeFileName (2.14a, 4.7)", () => {
  it("keeps the name, without what no file name may have", () => {
    expect(safeFileName("Rosa's Bakery", "My site")).toBe("Rosa's Bakery");
    expect(safeFileName('Fish & Chips: "Best" in town?', "My site")).toBe(
      "Fish & Chips- -Best- in town-",
    );
    expect(safeFileName(String.raw`A/B\C|D*E<F>G` + "\u0007", "My site")).toBe("A-B-C-D-E-F-G-");
    // Windows drops trailing dots and spaces.
    expect(safeFileName("  Café Rosa...  ", "My site")).toBe("Café Rosa");
    expect(safeFileName("Shop: front?.jpg", "file")).toBe("Shop- front-.jpg");
  });

  it("falls back when nothing usable is left, or Windows keeps the name for a device", () => {
    expect(safeFileName("...", "My site")).toBe("My site");
    expect(safeFileName("CON", "My site")).toBe("My site");
    expect(safeFileName("lpt1", "My site")).toBe("My site");
    // Whatever its extension.
    expect(safeFileName("con.jpg", "file")).toBe("file");
    expect(safeFileName("Nul.tar.gz", "file")).toBe("file");
    expect(safeFileName("console.jpg", "file")).toBe("console.jpg");
  });
});
