import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { describe, expect, it } from "vitest";
import { blockingCount, checkSite, ignoreKey, levelIn, SITE_CHECK_RULES } from "./check.js";
import { plainText } from "./fields.js";
import { siteWith } from "./test-site.test-helper.js";
import type { CheckRule } from "./types.js";

/** A rule finding `keys`, at `level`. */
const rule = (
  id: string,
  level: CheckRule["level"],
  keys: string[],
  strict = false,
): CheckRule => ({
  id,
  level,
  ...(strict ? { strictOnPublish: true as const } : {}),
  check: () => keys.map((key) => ({ key, place: { kind: "address" } as const })),
});

const input = { site: siteWith(), catalogue: CATALOGUE };

describe("checkSite (F-CHK-1, X5)", () => {
  it("runs every rule, unique by id, on a new site", () => {
    const ids = SITE_CHECK_RULES.map((each) => each.id);
    expect(new Set(ids).size).toBe(ids.length);

    const report = checkSite(input, "export");
    expect(report.results.map((result) => result.rule)).toEqual(ids);
    // A new site has no web address: worth adding, but nothing stops its export.
    expect(blockingCount(report)).toBe(0);
    expect(report.results.find((result) => result.rule === "webAddress")?.findings).toHaveLength(1);
  });

  it("turns the publish-strict rules into Must fix when publishing, and only those", () => {
    const strict = rule("links", "should", ["a"], true);
    const loose = rule("alt", "should", ["b"]);

    expect([levelIn(strict, "export"), levelIn(strict, "publish")]).toEqual(["should", "must"]);
    expect(levelIn(loose, "publish")).toBe("should");
    expect(blockingCount(checkSite(input, "export", new Set(), [strict, loose]))).toBe(0);
    expect(blockingCount(checkSite(input, "publish", new Set(), [strict, loose]))).toBe(1);
    // The new site's own: no web address, which publishing can't go without.
    expect(blockingCount(checkSite(input, "publish"))).toBe(1);
  });

  it("leaves out what was ignored, counting it, but never a Must fix", () => {
    const rules = [
      rule("names", "must", ["con"]),
      rule("links", "should", ["a", "b"], true),
      rule("tips", "tip", ["c"]),
    ];
    const ignored = new Set([
      ignoreKey("names", "con"),
      ignoreKey("links", "a"),
      ignoreKey("tips", "c"),
    ]);

    expect(checkSite(input, "export", ignored, rules).results).toEqual([
      {
        rule: "names",
        level: "must",
        findings: [expect.objectContaining({ key: "con" })],
        ignored: 0,
      },
      {
        rule: "links",
        level: "should",
        findings: [expect.objectContaining({ key: "b" })],
        ignored: 1,
      },
      { rule: "tips", level: "tip", findings: [], ignored: 1 },
    ]);
    // Publishing makes the links Must fix, which an earlier Ignore doesn't hide.
    const published = checkSite(input, "publish", ignored, rules).results[1];
    expect(published?.findings).toHaveLength(2);
    expect(ignoreKey("links", "a")).not.toBe(ignoreKey("tips", "a"));
  });
});

describe("plainText", () => {
  it("reads rich text as a visitor does: no tags, entities decoded, single spaces", () => {
    expect(plainText("<p>Fish &amp; chips</p><p>We&#39;re   open<br>late&nbsp;</p>")).toBe(
      "Fish & chips We're open late",
    );
    expect(plainText("<ul><li>a &lt; b</li><li>&quot;c&quot; &gt; d</li></ul>")).toBe(
      'a < b "c" > d',
    );
  });
});
