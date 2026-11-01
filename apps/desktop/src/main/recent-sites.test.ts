import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRecentSites, recentSiteId, recentSitesFeature } from "./recent-sites.js";

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
  it("lists opened sites newest first, by file name, without paths", async () => {
    const list = recent();
    const bakery = site("Rosa's Bakery");
    const florist = site("Florist");

    await list.opened(bakery, "Rosa's Bakery");
    clock = new Date("2026-10-21T10:00:00.000Z");
    await list.opened(florist, "Florist");

    expect(await list.list()).toEqual([
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
        open: false,
      },
      expect.objectContaining({ name: "Rosa's Bakery", fileName: "Rosa's Bakery.wforge" }),
    ]);
    // The site open in the window says so (3.18).
    expect((await list.list(bakery)).map((entry) => [entry.name, entry.open])).toEqual([
      ["Florist", false],
      ["Rosa's Bakery", true],
    ]);
    expect(JSON.stringify(await list.list())).not.toContain(dir.slice(3));
  });

  it("moves a reopened site to the top and keeps when it was edited", async () => {
    const list = recent();
    const bakery = site("Bakery");
    await list.opened(bakery, "Bakery");
    await list.edited(bakery);
    await list.opened(site("Other"), "Other");

    clock = new Date("2026-10-22T09:00:00.000Z");
    await list.opened(bakery, "Bakery");

    expect((await list.list()).map((entry) => [entry.name, entry.lastEdited])).toEqual([
      ["Bakery", "2026-10-21T09:00:00.000Z"],
      ["Other", null],
    ]);
  });

  it("records edits at most once a minute, and only for listed sites", async () => {
    const list = recent();
    const bakery = site("Bakery");
    await list.edited(bakery);
    expect(await list.list()).toEqual([]);

    await list.opened(bakery, "Bakery");
    await list.edited(bakery);
    clock = new Date(clock.getTime() + 30_000);
    await list.edited(bakery);
    expect((await list.list())[0]?.lastEdited).toBe("2026-10-21T09:00:00.000Z");
    clock = new Date(clock.getTime() + 60_000);
    await list.edited(bakery);
    expect((await list.list())[0]?.lastEdited).toBe("2026-10-21T09:01:30.000Z");
  });

  it("keeps the newest sites only, with their thumbnails", async () => {
    const list = recent(2);
    const paths: string[] = [];
    for (const name of ["A", "B", "C"]) {
      const path = site(name);
      await list.opened(path, name);
      await list.saveThumbnail(path, new Uint8Array([0xff, 0xd8, 0xff]));
      clock = new Date(clock.getTime() + 1_000);
      paths.push(path);
    }

    expect((await list.list()).map((entry) => entry.name)).toEqual(["C", "B"]);
    expect((await list.list())[0]?.thumbnail).toBe("data:image/jpeg;base64,/9j/");
    // The oldest site's thumbnail went with it.
    await list.opened(paths[1] ?? "", "B");
    expect(
      existsSync(
        join(dir, "user-data", "recent-thumbnails", `${recentSiteId(paths[0] ?? "")}.jpg`),
      ),
    ).toBe(false);
  });

  it("marks sites whose file has gone, finds paths by id and removes sites", async () => {
    const list = recent();
    const bakery = site("Bakery");
    await list.opened(bakery, "Bakery");
    const id = recentSiteId(bakery);
    rmSync(bakery);

    expect((await list.list())[0]?.missing).toBe(true);
    expect(await list.pathOf(id)).toBe(bakery);
    expect(await list.pathOf("0".repeat(32))).toBeUndefined();

    await list.remove("0".repeat(32));
    await list.remove(id);
    expect(await list.list()).toEqual([]);
  });

  it("ignores thumbnails for sites that aren't listed", async () => {
    const list = recent();
    await list.saveThumbnail(site("Bakery"), new Uint8Array([1]));

    expect(existsSync(join(dir, "user-data", "recent-thumbnails"))).toBe(false);
  });

  it("starts empty when the list file is damaged or from another version", async () => {
    mkdirSync(join(dir, "user-data"));
    for (const content of ["{", JSON.stringify({ version: 2, sites: [] })]) {
      writeFileSync(join(dir, "user-data", "recent.json"), content);
      expect(await recent().list()).toEqual([]);
    }
  });

  it("writes the list in one piece", async () => {
    const list = recent();
    await list.opened(site("Bakery"), "Bakery");

    const saved = JSON.parse(readFileSync(join(dir, "user-data", "recent.json"), "utf8"));
    expect(saved).toMatchObject({ version: 1, sites: [{ name: "Bakery" }] });
    expect(existsSync(join(dir, "user-data", "recent.json.tmp"))).toBe(false);
  });
});

describe("pinned recent sites (2.14b, LF-10)", () => {
  const names = async (list: ReturnType<typeof recent>) =>
    (await list.list()).map((each) => each.name);

  it("stay when the rest are cleared (Clear Recent, 3.18)", async () => {
    const list = recent();
    for (const name of ["Bakery", "Florist", "Plumber"]) await list.opened(site(name), name);
    await list.saveThumbnail(site("Florist"), new Uint8Array([1]));
    await list.setPinned(recentSiteId(site("Plumber")), true);

    await list.clearUnpinned();
    expect(await names(list)).toEqual(["Plumber"]);
    // Their thumbnails go with them.
    expect(
      existsSync(
        join(dir, "user-data", "recent-thumbnails", `${recentSiteId(site("Florist"))}.jpg`),
      ),
    ).toBe(false);

    // With only pinned sites left, there is nothing more to clear.
    await list.clearUnpinned();
    expect(await names(list)).toEqual(["Plumber"]);
  });

  it("come first, stay pinned when reopened, and unpin", async () => {
    const list = recent();
    for (const [at, name] of ["Bakery", "Florist", "Plumber"].entries()) {
      clock = new Date(Date.UTC(2026, 9, 21, 9 + at));
      await list.opened(site(name), name);
    }
    await list.setPinned(recentSiteId(site("Bakery")), true);

    expect(await names(list)).toEqual(["Bakery", "Plumber", "Florist"]);
    expect((await list.list())[0]?.pinned).toBe(true);

    // Reopening a site keeps its pin, and an unpinned one moves up among the rest.
    clock = new Date("2026-10-21T13:00:00.000Z");
    await list.opened(site("Bakery"), "Bakery");
    await list.opened(site("Florist"), "Florist");
    expect(await names(list)).toEqual(["Bakery", "Florist", "Plumber"]);
    expect((await list.list())[0]?.pinned).toBe(true);

    await list.setPinned(recentSiteId(site("Bakery")), false);
    expect((await list.list()).map((each) => each.pinned)).toEqual([false, false, false]);
    // Pinning a site that isn't listed changes nothing.
    await list.setPinned("f".repeat(32), true);
    expect(await names(list)).toEqual(["Florist", "Bakery", "Plumber"]);
  });

  it("are never dropped to keep the list short", async () => {
    const list = recent(2);
    await list.opened(site("Bakery"), "Bakery");
    await list.setPinned(recentSiteId(site("Bakery")), true);
    for (const name of ["Florist", "Plumber", "Cafe"]) await list.opened(site(name), name);

    expect(await names(list)).toEqual(["Bakery", "Cafe", "Plumber"]);
  });

  it("read as unpinned from a list written before pinning", async () => {
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

    expect(await recent().list()).toEqual([
      expect.objectContaining({ name: "Bakery", pinned: false }),
    ]);
  });
});

describe("recentSiteId", () => {
  it("is the same for one path written differently", async () => {
    expect(recentSiteId(join(dir, "a", "..", "x.wforge"))).toBe(
      recentSiteId(join(dir, "x.wforge")),
    );
    expect(recentSiteId(join(dir, "x.wforge"))).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("recentSitesFeature (A12)", () => {
  const recent = () => ({
    opened: vi.fn(async (_path: string, _name: string) => undefined),
    edited: vi.fn(async (_path: string) => undefined),
    idle: vi.fn(async () => undefined),
  });
  const path = join("C:", "Sites", "Bakery.wforge");
  const open = { current: () => ({ name: "Bakery" }), currentPath: () => path };
  const access = vi.fn();

  it("puts a site that opens at the top, and marks it edited as it's saved", () => {
    const list = recent();
    const feature = recentSitesFeature(list, open);

    feature.site?.opened?.(access, path);
    feature.site?.committed?.();

    expect(list.opened).toHaveBeenCalledWith(path, "Bakery");
    expect(list.edited).toHaveBeenCalledWith(path);
  });

  it("does nothing while no site is open", () => {
    const list = recent();
    const feature = recentSitesFeature(list, {
      current: () => null,
      currentPath: () => undefined,
    });

    feature.site?.opened?.(access, path);
    feature.site?.committed?.();

    expect(list.opened).not.toHaveBeenCalled();
    expect(list.edited).not.toHaveBeenCalled();
  });

  it("logs a write that fails by its code, and finishes its last write as Webforge quits", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const list = recent();
    list.opened.mockRejectedValueOnce(Object.assign(new Error("EPERM"), { code: "EPERM" }));
    const feature = recentSitesFeature(list, open);

    feature.site?.opened?.(access, path);
    await feature.quit?.();

    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        "Webforge could not update the Recent list (code=Error EPERM)",
      ),
    );
    expect(list.idle).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});
