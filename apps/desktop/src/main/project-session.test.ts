import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectStore } from "@webforge/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findProjectArgument, ProjectSession, withProjectExtension } from "./project-session.js";

let dir: string;
let session: ProjectSession;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-desktop-"));
  session = new ProjectSession();
  // Failures are logged by design; keep test output clean.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  session.close();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

describe("ProjectSession", () => {
  it("has no site until one is created or opened", () => {
    expect(session.current()).toBeNull();
  });

  it("creates a site named after its file and makes it current", () => {
    const result = session.create(join(dir, "Rosa's Bakery.wforge"));

    const project = { name: "Rosa's Bakery", fileName: "Rosa's Bakery.wforge", formatVersion: 1 };
    expect(result).toEqual({ status: "opened", project });
    expect(session.current()).toEqual(project);
  });

  it("adds the .wforge extension when the save dialog returns a path without it", () => {
    const result = session.create(join(dir, "Bakery"));

    expect(result).toMatchObject({ status: "opened", project: { fileName: "Bakery.wforge" } });
  });

  it("falls back to a default name when the file name is blank", () => {
    const result = session.create(join(dir, " .wforge"));

    expect(result).toMatchObject({ status: "opened", project: { name: "My site" } });
  });

  it("opens an existing site", () => {
    const path = join(dir, "site.wforge");
    session.create(path);
    session.close();

    expect(session.open(path)).toMatchObject({ status: "opened", project: { name: "site" } });
  });

  it("replaces the current site when it creates one over the same file", () => {
    const path = join(dir, "site.wforge");
    session.create(path);

    // Windows can't replace a file that is open; the session closes it first.
    expect(session.create(path)).toMatchObject({ status: "opened" });
    expect(session.current()?.fileName).toBe("site.wforge");
  });

  it("keeps the current site when another one fails to open", () => {
    session.create(join(dir, "good.wforge"));
    const bad = join(dir, "bad.wforge");
    writeFileSync(bad, "not a database");

    expect(session.open(bad)).toEqual({ status: "failed", reason: "not-a-project" });
    expect(session.open(join(dir, "missing.wforge"))).toEqual({
      status: "failed",
      reason: "not-found",
    });
    expect(session.current()?.fileName).toBe("good.wforge");
  });

  it("asks for an update instead of opening a site from a newer Webforge", () => {
    const path = join(dir, "newer.wforge");
    session.create(path);
    session.close();
    const store = ProjectStore.open(path);
    const close = vi.spyOn(store, "close");
    vi.spyOn(store, "info", "get").mockReturnValue({ ...store.info, newerFormat: true });
    vi.spyOn(ProjectStore, "open").mockReturnValue(store);

    expect(session.open(path)).toEqual({ status: "failed", reason: "newer-format" });
    expect(session.current()).toBeNull();
    expect(close).toHaveBeenCalled();
  });

  it("reports other errors as unknown without logging the path", () => {
    const folder = join(dir, "a-folder.wforge");
    mkdirSync(folder);

    expect(session.create(folder)).toEqual({ status: "failed", reason: "unknown" });
    for (const [message] of vi.mocked(console.error).mock.calls) {
      expect(String(message)).not.toContain(dir);
    }
  });
});

describe("withProjectExtension", () => {
  it("adds .wforge only when it is missing", () => {
    expect(withProjectExtension("site")).toBe("site.wforge");
    expect(withProjectExtension("site.wforge")).toBe("site.wforge");
    expect(withProjectExtension("SITE.WFORGE")).toBe("SITE.WFORGE");
  });
});

describe("findProjectArgument", () => {
  it("finds a .wforge path among the command-line arguments", () => {
    expect(findProjectArgument(["Webforge.exe", "C:\\Sites\\Bakery.wforge"])).toBe(
      "C:\\Sites\\Bakery.wforge",
    );
    expect(
      findProjectArgument(["electron", "apps/desktop", "--flag=x.wforge", "/sites/A.WFORGE"]),
    ).toBe("/sites/A.WFORGE");
  });

  it("ignores the executable and other arguments", () => {
    expect(findProjectArgument(["/Applications/x.wforge"])).toBeUndefined();
    expect(findProjectArgument(["Webforge.exe", "--remote-debugging-port=0"])).toBeUndefined();
  });
});
