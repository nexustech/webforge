import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "../../shared/ipc/prefs.js";
import { setFailureLog } from "../log.js";
import { createPreferencesStore, followLayoutLock } from "./preferences-store.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createPreferencesStore (R9)", () => {
  it("starts from the defaults in Design mode, unless given others", () => {
    expect(createPreferencesStore().getState()).toEqual({
      preferences: DEFAULT_PREFERENCES,
      mode: "design",
    });
    const dark = { ...DEFAULT_PREFERENCES, theme: "dark" as const };
    expect(createPreferencesStore({ preferences: dark, mode: "content" }).getState()).toEqual({
      preferences: dark,
      mode: "content",
    });
  });

  it("changes several groups one after another, each kept, and saves each change", () => {
    const save = vi.fn(async () => undefined);
    const store = createPreferencesStore({}, { preferences: save });
    const seen = vi.fn();
    store.subscribe(seen);

    store.change({ theme: "dark" });
    store.change({ editorLevel: "advanced" });

    expect(store.getState().preferences).toMatchObject({ theme: "dark", editorLevel: "advanced" });
    expect(save.mock.calls).toEqual([[{ theme: "dark" }], [{ editorLevel: "advanced" }]]);
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it("switches the mode and remembers it, and does nothing for the mode it is in", () => {
    const save = vi.fn(async () => undefined);
    const store = createPreferencesStore({}, { mode: save });

    store.changeMode("design");
    expect(save).not.toHaveBeenCalled();
    store.changeMode("content");
    expect(store.getState().mode).toBe("content");
    expect(save).toHaveBeenCalledExactlyOnceWith("content");
  });

  it("keeps a change it could not save, and logs only the failure's code (R12)", async () => {
    const failures = vi.fn(async () => null);
    setFailureLog(failures);
    const store = createPreferencesStore(
      {},
      {
        preferences: async () => Promise.reject(new Error("disk full")),
        mode: async () => Promise.reject(new TypeError("gone")),
      },
    );

    store.change({ theme: "dark" });
    store.changeMode("content");
    await vi.waitFor(() => expect(failures).toHaveBeenCalledTimes(2));

    expect(store.getState()).toMatchObject({ preferences: { theme: "dark" }, mode: "content" });
    expect(failures.mock.calls).toEqual([
      ["preferences.save", "Error"],
      ["editor-mode.save", "TypeError"],
    ]);
    setFailureLog(undefined);
  });
});

describe("followLayoutLock (2.20, B1)", () => {
  it("says whether the mode locks the layout, now and as that changes", () => {
    const store = createPreferencesStore();
    const locked: boolean[] = [];

    const stop = followLayoutLock(store, (next) => locked.push(next));
    store.changeMode("content");
    store.change({ theme: "dark" });
    store.changeMode("design");
    stop();
    store.changeMode("content");

    expect(locked).toEqual([false, true, false]);
  });
});
