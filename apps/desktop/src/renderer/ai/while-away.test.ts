import { describe, expect, it } from "vitest";
import type { VersionSummary } from "../../shared/ipc/versions.js";
import { createAwayLog, groupAway, versionBefore } from "./while-away.js";

const TITLES: Record<string, string> = { home: "Home", about: "About" };
const titleOf = (pageId: string) => TITLES[pageId];

/** A version saved at `at` (ms), named `name`. */
const version = (name: string, at: number): VersionSummary => ({
  id: crypto.randomUUID(),
  name,
  reason: name === "" ? "before-site-wide" : "manual",
  createdAt: new Date(at).toISOString(),
  bytes: 0,
});

describe("what an app changed while the person was away (5.36, UA-3)", () => {
  it("groups the changes by app, then by page, each in the order made, without the app's name", () => {
    expect(
      groupAway(
        [
          { app: "Claude", label: "AI (Claude): Edited Hero text", pageId: "home", at: 10 },
          { app: "Claude", label: "AI (Claude): Changed the theme", at: 20 },
          { app: "Cursor", label: "AI (Cursor): Added Gallery", pageId: "about", at: 25 },
          { app: "Claude", label: "AI (Claude): Added Heading", pageId: "home", at: 30 },
          // A page deleted since: nothing to show, so it's with those on every page.
          { app: "Claude", label: "AI (Claude): Edited Text", pageId: "gone", at: 40 },
        ],
        titleOf,
      ),
    ).toEqual([
      {
        app: "Claude",
        firstAt: 10,
        pages: [
          { pageId: "home", title: "Home", changes: ["Edited Hero text", "Added Heading"] },
          { pageId: null, title: "Every page", changes: ["Changed the theme", "Edited Text"] },
        ],
      },
      {
        app: "Cursor",
        firstAt: 25,
        pages: [{ pageId: "about", title: "About", changes: ["Added Gallery"] }],
      },
    ]);
  });

  it("shows nothing when no change was made", () => {
    expect(groupAway([], titleOf)).toEqual([]);
  });

  it("finds the version before the app's first change by its name, or else by its time", () => {
    const before = version("Before Claude's changes", 1_000);
    const later = version("", 5_000);
    // Newest first, as main lists them.
    expect(versionBefore([later, before], "Claude", 3_000)).toBe(before);

    // Main saved none: one from moments before held the site already (4.6).
    const earlier = version("", 900);
    expect(versionBefore([later, earlier], "Claude", 3_000)).toBe(earlier);
    expect(versionBefore([later], "Claude", 3_000)).toBeUndefined();
  });

  it("keeps the changes until they're taken, once", () => {
    const log = createAwayLog();
    log.record({ app: "Claude", label: "AI (Claude): Changed the theme", at: 1 });
    expect(log.take()).toHaveLength(1);
    expect(log.take()).toEqual([]);
  });
});
