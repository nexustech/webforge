import { describe, expect, it } from "vitest";
import { escapeHtml, escapeHtmlText, escapeRegExp } from "./escape.js";
import { SHA256_HEX, sha256HexSchema } from "./hashes.js";
import { isRecord } from "./is-record.js";

describe("escapeHtml and escapeHtmlText (#988)", () => {
  it("escape what HTML reads as markup, and quotes for an attribute only with escapeHtml", () => {
    const text = `Tom & Jerry's <b>"best"</b>`;

    expect(escapeHtmlText(text)).toBe(`Tom &amp; Jerry's &lt;b&gt;"best"&lt;/b&gt;`);
    expect(escapeHtml(text)).toBe(`Tom &amp; Jerry's &lt;b&gt;&quot;best&quot;&lt;/b&gt;`);
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });
});

describe("escapeRegExp (#988)", () => {
  it("makes a regular expression that matches the text and nothing else", () => {
    const text = String.raw`£5.00 (each) [a+b]* ^$ {1} | \ ?`;
    const pattern = new RegExp(`^${escapeRegExp(text)}$`);

    expect(pattern.test(text)).toBe(true);
    expect(pattern.test(text.replace(".", "x"))).toBe(false);
    expect(pattern.test(text.replace("\\", ""))).toBe(false);
  });
});

describe("SHA256_HEX and isRecord (#988)", () => {
  it("takes 64 lower-case hex digits only", () => {
    expect(sha256HexSchema.safeParse("a".repeat(64)).success).toBe(true);
    expect(SHA256_HEX.test("A".repeat(64))).toBe(false);
    expect(SHA256_HEX.test("a".repeat(63))).toBe(false);
  });

  it("knows a plain object from null, an array and a value", () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord("a")).toBe(false);
  });
});
