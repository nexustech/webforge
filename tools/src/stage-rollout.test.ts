import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { type Gh, parseArgs, stageRollout, withStagingPercentage } from "./stage-rollout.js";

const FEED = `version: 1.2.0
files:
  - url: Webforge-Setup-1.2.0.exe
    sha512: abc
    size: 137191564
path: Webforge-Setup-1.2.0.exe
sha512: abc
releaseDate: '2026-11-09T11:50:47.998Z'
`;

describe("a feed file offered to some of Stable (5.2)", () => {
  it("adds the share, replaces one already there, and removes it for 100", () => {
    const twenty = withStagingPercentage(FEED, 20);
    expect(twenty).toBe(`${FEED}stagingPercentage: 20\n`);
    expect(withStagingPercentage(twenty, 50)).toBe(`${FEED}stagingPercentage: 50\n`);
    expect(withStagingPercentage(twenty, 100)).toBe(FEED);
  });

  it("keeps the rest as it was, with or without a last line break or Windows' line ends", () => {
    expect(withStagingPercentage("version: 1.2.0", 5)).toBe(
      "version: 1.2.0\nstagingPercentage: 5\n",
    );
    expect(withStagingPercentage("stagingPercentage: 5\r\nversion: 1.2.0\r\n", 10)).toBe(
      "version: 1.2.0\r\nstagingPercentage: 10\n",
    );
    // Only the top-level key: an indented one belongs to something else.
    const nested = "files:\n  stagingPercentage: 3\n";
    expect(withStagingPercentage(nested, 100)).toBe(nested);
  });
});

describe("the command line", () => {
  it("takes a release's tag and a whole percentage from 1 to 100", () => {
    expect(parseArgs(["v1.2.0", "20"])).toEqual({ tag: "v1.2.0", percent: 20 });
    expect(parseArgs(["v1.2.0", "100"])).toEqual({ tag: "v1.2.0", percent: 100 });
    for (const args of [[], ["v1.2.0"], ["1.2.0", "20"], ["v1.2.0", "20", "more"]]) {
      expect(parseArgs(args)).toHaveProperty("error", expect.stringContaining("Usage"));
    }
    for (const percent of ["0", "101", "12.5", "half"]) {
      expect(parseArgs(["v1.2.0", percent])).toHaveProperty(
        "error",
        expect.stringContaining("whole number"),
      );
    }
  });
});

/**
 * A `gh` that answers `release view` with `release`, keeps the feed files in `assets` (name →
 * content), and records each command.
 */
function fakeGh(
  release: { isDraft: boolean; isPrerelease: boolean },
  assets: Map<string, string>,
): { gh: Gh; calls: string[] } {
  const calls: string[] = [];
  const gh: Gh = (args) => {
    const [, command, , ...rest] = args;
    calls.push(command === "upload" ? `upload ${basename(rest[0] ?? "")}` : args.join(" "));
    if (command === "view") {
      return JSON.stringify({ ...release, assets: [...assets.keys()].map((name) => ({ name })) });
    }
    if (command === "download") {
      const name = rest[1] ?? "";
      writeFileSync(join(rest[3] ?? "", name), assets.get(name) ?? "");
    }
    if (command === "upload") {
      const file = rest[0] ?? "";
      assets.set(basename(file), readFileSync(file, "utf8"));
    }
    return "";
  };
  return { gh, calls };
}

describe("moving a release to Stable", () => {
  it("stages both feed files first, then makes a Beta release the latest", () => {
    const assets = new Map([
      ["latest.yml", FEED],
      ["latest-mac.yml", FEED],
      ["beta.yml", FEED],
      ["Webforge-Setup-1.2.0.exe", ""],
    ]);
    const { gh, calls } = fakeGh({ isDraft: false, isPrerelease: true }, assets);

    expect(stageRollout("v1.2.0", 20, gh)).toEqual([
      "latest.yml: offered to 20% of Stable.",
      "latest-mac.yml: offered to 20% of Stable.",
      "v1.2.0 is the latest release now: Stable gets it.",
    ]);
    expect(calls.map((call) => call.split(" --dir")[0])).toEqual([
      "release view v1.2.0 --json isDraft,isPrerelease,assets",
      "release download v1.2.0 --pattern latest.yml",
      "upload latest.yml",
      "release download v1.2.0 --pattern latest-mac.yml",
      "upload latest-mac.yml",
      "release edit v1.2.0 --prerelease=false --latest",
    ]);
    expect(assets.get("latest.yml")).toBe(`${FEED}stagingPercentage: 20\n`);
    expect(assets.get("latest-mac.yml")).toBe(`${FEED}stagingPercentage: 20\n`);
    // Beta's own feed stays offered to everyone on Beta.
    expect(assets.get("beta.yml")).toBe(FEED);
  });

  it("only changes the share of a release already on Stable", () => {
    const assets = new Map([["latest.yml", `${FEED}stagingPercentage: 20\n`]]);
    const { gh, calls } = fakeGh({ isDraft: false, isPrerelease: false }, assets);

    expect(stageRollout("v1.2.0", 100, gh)).toEqual(["latest.yml: offered to 100% of Stable."]);
    expect(calls.some((call) => call.startsWith("release edit"))).toBe(false);
    expect(assets.get("latest.yml")).toBe(FEED);
  });

  it("refuses a draft, and a release with no feed files, changing nothing", () => {
    const draft = fakeGh({ isDraft: true, isPrerelease: false }, new Map([["latest.yml", FEED]]));
    expect(() => stageRollout("v1.2.0", 20, draft.gh)).toThrow("still a draft");
    expect(draft.calls).toHaveLength(1);

    const other = fakeGh({ isDraft: false, isPrerelease: true }, new Map([["notes.txt", ""]]));
    expect(() => stageRollout("v1.2.0", 20, other.gh)).toThrow("isn't an app release");
    expect(other.calls).toHaveLength(1);
  });
});
