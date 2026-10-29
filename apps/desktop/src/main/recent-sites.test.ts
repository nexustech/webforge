import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRecentSites, recentSiteId } from "./recent-sites.js";

let dir: string;
let clock: Date;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-recent-"));
  mkdirSync(join(dir, "sites"));
  clock = new Date("2026-10-21T09:00:00.000Z");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function site(name: string): string {
  const path = join(dir, "sites", `${name}.wforge`);
  writeFileSync(path, "");
  return path;
}

const recent = (max?: number) =>
  createRecentSites({
    dir: join(dir, "user-data"),
    now: () => clock,
    ...(max === undefined ? {} : { max }),
  });

describe("createRecentSites", () => {
  it("lists opened sites newest first, by file name, without paths", () => {
    const list = recent();
    const bakery = site("Rosa's Bakery");
    const florist = site("Florist");

    list.opened(bakery, "Rosa's Bakery");
    clock = new Date("2026-10-21T10:00:00.000Z");
    list.opened(florist, "Florist");

    expect(list.list()).toEqual([
      {
        id: recentSiteId(florist),
        name: "Florist",
        fileName: "Florist.wforge",
        lastOpened: "2026-10-21T10:00:00.000Z",
        lastEdited: null,
        folder: "sites",
        thumbnail: null,
        missing: false,
        pinned: false,
      },
      expect.objectContaining({ name: "Rosa's Bakery", fileName: "Rosa's Bakery.wforge" }),
    ]);
    expect(JSON.stringify(list.list())).not.toContain(dir.slice(3));
  });

  it("moves a reopened site to the top and keeps when it was edited", () => {
    const list = recent();
    const bakery = site("Bakery");
    list.opened(bakery, "Bakery");
    list.edited(bakery);
    list.opened(site("Other"), "Other");

    clock = new Date("2026-10-22T09:00:00.000Z");
    list.opened(bakery, "Bakery");

    expect(list.list().map((entry) => [entry.name, entry.lastEdited])).toEqual([
      ["Bakery", "2026-10-21T09:00:00.000Z"],
      ["Other", null],
    ]);
  });

  it("records edits at most once a minute, and only for listed sites", () => {
    const list = recent();
    const bakery = site("Bakery");
    list.edited(bakery);
    expect(list.list()).toEqual([]);

    list.opened(bakery, "Bakery");
    list.edited(bakery);
    clock = new Date(clock.getTime() + 30_000);
    list.edited(bakery);
    expect(list.list()[0]?.lastEdited).toBe("2026-10-21T09:00:00.000Z");
    clock = new Date(clock.getTime() + 60_000);
    list.edited(bakery);
    expect(list.list()[0]?.lastEdited).toBe("2026-10-21T09:01:30.000Z");
  });

  it("keeps the newest sites only, with their thumbnails", () => {
    const list = recent(2);
    const paths = ["A", "B", "C"].map((name) => {
      const path = site(name);
      list.opened(path, name);
      list.saveThumbnail(path, new Uint8Array([0xff, 0xd8, 0xff]));
      clock = new Date(clock.getTime() + 1_000);
      return path;
    });

    expect(list.list().map((entry) => entry.name)).toEqual(["C", "B"]);
    expect(list.list()[0]?.thumbnail).toBe("data:image/jpeg;base64,/9j/");
    // The oldest site's thumbnail went with it.
    list.opened(paths[1] ?? "", "B");
    expect(
      existsSync(
        join(dir, "user-data", "recent-thumbnails", `${recentSiteId(paths[0] ?? "")}.jpg`),
      ),
    ).toBe(false);
  });

  it("marks sites whose file has gone, finds paths by id and removes sites", () => {
    const list = recent();
    const bakery = site("Bakery");
    list.opened(bakery, "Bakery");
    const id = recentSiteId(bakery);
    rmSync(bakery);

    expect(list.list()[0]?.missing).toBe(true);
    expect(list.pathOf(id)).toBe(bakery);
    expect(list.pathOf("0".repeat(32))).toBeUndefined();

    list.remove("0".repeat(32));
    list.remove(id);
    expect(list.list()).toEqual([]);
  });

  it("ignores thumbnails for sites that aren't listed", () => {
    const list = recent();
    list.saveThumbnail(site("Bakery"), new Uint8Array([1]));

    expect(existsSync(join(dir, "user-data", "recent-thumbnails"))).toBe(false);
  });

  it("starts empty when the list file is damaged or from another version", () => {
    mkdirSync(join(dir, "user-data"));
    for (const content of ["{", JSON.stringify({ version: 2, sites: [] })]) {
      writeFileSync(join(dir, "user-data", "recent.json"), content);
      expect(recent().list()).toEqual([]);
    }
  });

  it("writes the list in one piece", () => {
    const list = recent();
    list.opened(site("Bakery"), "Bakery");

    const saved = JSON.parse(readFileSync(join(dir, "user-data", "recent.json"), "utf8"));
    expect(saved).toMatchObject({ version: 1, sites: [{ name: "Bakery" }] });
    expect(existsSync(join(dir, "user-data", "recent.json.tmp"))).toBe(false);
  });
});

describe("pinned recent sites (2.14b, LF-10)", () => {
  const names = (list: ReturnType<typeof recent>) => list.list().map((each) => each.name);

  it("stay when the rest are cleared (Clear Recent, 3.18)", () => {
    const list = recent();
    for (const name of ["Bakery", "Florist", "Plumber"]) list.opened(site(name), name);
    list.saveThumbnail(site("Florist"), new Uint8Array([1]));
    list.setPinned(recentSiteId(site("Plumber")), true);

    list.clearUnpinned();
    expect(names(list)).toEqual(["Plumber"]);
    // Their thumbnails go with them.
    expect(
      existsSync(
        join(dir, "user-data", "recent-thumbnails", `${recentSiteId(site("Florist"))}.jpg`),
      ),
    ).toBe(false);

    // With only pinned sites left, there is nothing more to clear.
    list.clearUnpinned();
    expect(names(list)).toEqual(["Plumber"]);
  });

  it("come first, stay pinned when reopened, and unpin", () => {
    const list = recent();
    for (const [at, name] of ["Bakery", "Florist", "Plumber"].entries()) {
      clock = new Date(Date.UTC(2026, 9, 21, 9 + at));
      list.opened(site(name), name);
    }
    list.setPinned(recentSiteId(site("Bakery")), true);

    expect(names(list)).toEqual(["Bakery", "Plumber", "Florist"]);
    expect(list.list()[0]?.pinned).toBe(true);

    // Reopening a site keeps its pin, and an unpinned one moves up among the rest.
    clock = new Date("2026-10-21T13:00:00.000Z");
    list.opened(site("Bakery"), "Bakery");
    list.opened(site("Florist"), "Florist");
    expect(names(list)).toEqual(["Bakery", "Florist", "Plumber"]);
    expect(list.list()[0]?.pinned).toBe(true);

    list.setPinned(recentSiteId(site("Bakery")), false);
    expect(list.list().map((each) => each.pinned)).toEqual([false, false, false]);
    // Pinning a site that isn't listed changes nothing.
    list.setPinned("f".repeat(32), true);
    expect(names(list)).toEqual(["Florist", "Bakery", "Plumber"]);
  });

  it("are never dropped to keep the list short", () => {
    const list = recent(2);
    list.opened(site("Bakery"), "Bakery");
    list.setPinned(recentSiteId(site("Bakery")), true);
    for (const name of ["Florist", "Plumber", "Cafe"]) list.opened(site(name), name);

    expect(names(list)).toEqual(["Bakery", "Cafe", "Plumber"]);
  });

  it("read as unpinned from a list written before pinning", () => {
    const path = site("Bakery");
    mkdirSync(join(dir, "user-data"), { recursive: true });
    writeFileSync(
      join(dir, "user-data", "recent.json"),
      JSON.stringify({
        version: 1,
        sites: [
          {
            id: recentSiteId(path),
            path,
            name: "Bakery",
            lastOpened: "2026-10-20T09:00:00.000Z",
            lastEdited: null,
          },
        ],
      }),
    );

    expect(recent().list()).toEqual([expect.objectContaining({ name: "Bakery", pinned: false })]);
  });
});

describe("recentSiteId", () => {
  it("is the same for one path written differently", () => {
    expect(recentSiteId(join(dir, "a", "..", "x.wforge"))).toBe(
      recentSiteId(join(dir, "x.wforge")),
    );
    expect(recentSiteId(join(dir, "x.wforge"))).toMatch(/^[0-9a-f]{32}$/);
  });
});
