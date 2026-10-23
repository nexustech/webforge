import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "../shared/ipc/prefs.js";
import {
  openPreferencesStore,
  parsePreferences,
  registerPreferencesHandlers,
} from "./preferences.js";

describe("parsePreferences", () => {
  it("gives the defaults for anything that isn't an object", () => {
    expect(parsePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences("dark")).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
  });

  it("keeps valid fields and replaces invalid ones with defaults", () => {
    expect(
      parsePreferences({
        theme: "light",
        editorLevel: "expert",
        panelLayout: { "shell.columns": { left: 20, center: 60, right: 20 } },
        unknown: true,
      }),
    ).toEqual({
      theme: "light",
      editorLevel: "simple",
      panelLayout: { "shell.columns": { left: 20, center: 60, right: 20 } },
      window: null,
      canvas: DEFAULT_PREFERENCES.canvas,
      add: DEFAULT_PREFERENCES.add,
    });
    expect(parsePreferences({ panelLayout: { group: { panel: 250 } } }).panelLayout).toEqual({});
    // A device too narrow for the canvas makes the canvas preferences the defaults.
    const device = { id: "phone", name: "Old phone", width: 240, height: 320 };
    expect(
      parsePreferences({ canvas: { ...DEFAULT_PREFERENCES.canvas, devices: [device] } }).canvas,
    ).toEqual(DEFAULT_PREFERENCES.canvas);
    const tooMany = Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`g${i}`, {}]));
    expect(parsePreferences({ panelLayout: tooMany }).panelLayout).toEqual({});
  });

  it("keeps the Add panel's favourites and recently used, or none if the list is invalid", () => {
    const add = { favourites: ["Faq", "shared-hours"], recent: ["Hero"] };
    expect(parsePreferences({ add }).add).toEqual(add);
    expect(parsePreferences({ add: { favourites: [""], recent: [] } }).add).toEqual(
      DEFAULT_PREFERENCES.add,
    );
    expect(
      parsePreferences({ add: { favourites: [], recent: Array(7).fill("Hero") } }).add,
    ).toEqual(DEFAULT_PREFERENCES.add);
  });
});

describe("openPreferencesStore", () => {
  const tempDir = tempDirFactory();
  let file: string;

  beforeEach(() => {
    file = join(tempDir(), "preferences.json");
  });

  it("starts from the defaults when there is no file", async () => {
    const store = await openPreferencesStore(file);

    expect(store.get()).toEqual(DEFAULT_PREFERENCES);
  });

  it("starts from the defaults when the file is not JSON", async () => {
    writeFileSync(file, "{ not json");

    expect((await openPreferencesStore(file)).get()).toEqual(DEFAULT_PREFERENCES);
  });

  it("saves a change and reads it back next time", async () => {
    const store = await openPreferencesStore(file);

    const saved = await store.set({ theme: "light" });

    expect(saved).toEqual({ ...DEFAULT_PREFERENCES, theme: "light" });
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(saved);
    expect((await openPreferencesStore(file)).get().theme).toBe("light");
  });

  it("remembers the window, and forgets an invalid one", async () => {
    const window = { maximized: false, bounds: { x: 10, y: 20, width: 1100, height: 700 } };
    const store = await openPreferencesStore(file);

    await store.set({ window });
    await store.set({ theme: "light" });

    expect((await openPreferencesStore(file)).get().window).toEqual(window);
    expect(parsePreferences({ window: { maximized: "yes" } }).window).toBeNull();
  });

  it("applies quick successive changes in order", async () => {
    const store = await openPreferencesStore(file);

    const first = store.set({ theme: "light" });
    const second = store.set({ editorLevel: "advanced" });
    await Promise.all([first, second]);

    expect((await openPreferencesStore(file)).get()).toEqual({
      ...DEFAULT_PREFERENCES,
      theme: "light",
      editorLevel: "advanced",
    });
  });

  it("keeps saving after a write fails", async () => {
    // The folder doesn't exist yet, so the first write fails.
    const folder = join(tempDir(), "later");
    const store = await openPreferencesStore(join(folder, "preferences.json"));
    await expect(store.set({ theme: "light" })).rejects.toThrow();

    mkdirSync(folder);
    await store.set({ editorLevel: "advanced" });

    expect(JSON.parse(readFileSync(join(folder, "preferences.json"), "utf8"))).toMatchObject({
      theme: "light",
      editorLevel: "advanced",
    });
  });

  it("refuses an invalid change and keeps the preferences as they were", async () => {
    const store = await openPreferencesStore(file);

    // @ts-expect-error: not a theme.
    expect(() => store.set({ theme: "blue" })).toThrow();
    expect(store.get()).toEqual(DEFAULT_PREFERENCES);
  });
});

describe("registerPreferencesHandlers", () => {
  it("serves prefs:get and prefs:set to the app's own page, and reports changes", async () => {
    const handlers = new Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>();
    const ipc = { handle: vi.fn((channel: string, handler) => handlers.set(channel, handler)) };
    const store = {
      get: vi.fn(() => DEFAULT_PREFERENCES),
      set: vi.fn(async () => ({ ...DEFAULT_PREFERENCES, theme: "light" as const })),
    };
    const onChange = vi.fn();
    registerPreferencesHandlers(ipc, (url) => url === "app://", store, onChange);
    const event = { senderFrame: { url: "app://" } };

    await expect(handlers.get("prefs:get")?.(event)).resolves.toEqual(DEFAULT_PREFERENCES);
    await expect(handlers.get("prefs:set")?.(event, { theme: "light" })).resolves.toMatchObject({
      theme: "light",
    });
    expect(store.set).toHaveBeenCalledWith({ theme: "light" });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ theme: "light" }));
    await expect(handlers.get("prefs:set")?.(event, { theme: "blue" })).rejects.toThrow();
  });
});
