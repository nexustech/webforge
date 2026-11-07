import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { licenceFiles, registerLicenceHandlers } from "./licences.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-licences-"));
  // A failed read is logged by design; keep the output clean.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

const REACT = {
  name: "react",
  version: "19.2.0",
  licence: "MIT",
  homepage: "https://react.dev/",
  text: "MIT License",
};

/** The handlers over notices in `dir`, Chromium's at `chromium`, opened with `openPath`. */
function setUp(openPath: (path: string) => Promise<string> = async () => "") {
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (channel: string, handler: Handler) => registered.set(channel, handler),
  } as unknown as Pick<IpcMain, "handle">;
  registerLicenceHandlers(
    ipc,
    () => true,
    { noticesDir: dir, chromium: join(dir, "LICENSES.chromium.html") },
    openPath,
  );
  const invoke = (channel: string) =>
    registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent);
  return { invoke };
}

const writeNotices = (content: unknown) =>
  writeFileSync(join(dir, "notices.json"), JSON.stringify(content));

describe("Open-Source Licences' calls (5.3)", () => {
  it("lists the packages from the build's notices, read once", async () => {
    writeNotices({ packages: [REACT] });
    const { invoke } = setUp();

    expect(await invoke("app:list-licences")).toEqual({ status: "listed", packages: [REACT] });
    // Read once: a later change to the file isn't read again while the app runs.
    writeNotices({ packages: [] });
    expect(await invoke("app:list-licences")).toEqual({ status: "listed", packages: [REACT] });
  });

  it("says so when the notices are missing or not as the build writes them, and tries again", async () => {
    const { invoke } = setUp();
    expect(await invoke("app:list-licences")).toEqual({ status: "failed" });

    writeNotices({ packages: [{ ...REACT, homepage: "javascript:alert(1)" }] });
    expect(await invoke("app:list-licences")).toEqual({ status: "failed" });

    writeNotices({ packages: [REACT] });
    expect(await invoke("app:list-licences")).toEqual({ status: "listed", packages: [REACT] });
  });

  it("opens Chromium's licences, its own file only, and says when it couldn't", async () => {
    const openPath = vi.fn(async (_path: string) => "");
    expect(await setUp(openPath).invoke("app:open-chromium-licences")).toBe(true);
    expect(openPath).toHaveBeenCalledWith(join(dir, "LICENSES.chromium.html"));

    expect(await setUp(async () => "No application").invoke("app:open-chromium-licences")).toBe(
      false,
    );
    expect(
      await setUp(async () => {
        throw new Error("gone");
      }).invoke("app:open-chromium-licences"),
    ).toBe(false);
  });
});

describe("licenceFiles", () => {
  const where = { appPath: "/app", resourcesPath: "/res", execDir: "/program" };

  it("reads the build's notices and Electron's Chromium licences in development", () => {
    expect(licenceFiles({ ...where, packaged: false, platform: "win32" })).toEqual({
      noticesDir: join("/app", "out", "notices"),
      chromium: join("/app", "node_modules", "electron", "dist", "LICENSES.chromium.html"),
    });
  });

  it("finds Chromium's beside the program on Windows, and in the app's Resources on macOS", () => {
    expect(licenceFiles({ ...where, packaged: true, platform: "win32" })).toEqual({
      noticesDir: join("/res", "notices"),
      chromium: join("/program", "LICENSES.chromium.html"),
    });
    expect(licenceFiles({ ...where, packaged: true, platform: "darwin" })).toEqual({
      noticesDir: join("/res", "notices"),
      chromium: join("/res", "LICENSES.chromium.html"),
    });
  });
});

// The notices the real build writes are checked by the E2E tests (e2e/app/licences.spec.ts).
