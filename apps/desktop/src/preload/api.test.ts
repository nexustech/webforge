import { changedDocuments, createSite } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
import { createWebforgeApi, type Invoke, type Subscribe } from "./api.js";

const noEvents: Subscribe = () => () => undefined;

/** The API without main-process events, for the request/response tests. */
const apiWith = (invoke: Invoke) => createWebforgeApi(invoke, noEvents);

describe("createWebforgeApi", () => {
  it("calls the contract channel and returns the parsed app info", async () => {
    const invoke = vi.fn(async () => ({ name: "Webforge", version: "1.0.0" }));
    const api = apiWith(invoke);

    await expect(api.app.getInfo()).resolves.toEqual({ name: "Webforge", version: "1.0.0" });
    expect(invoke).toHaveBeenCalledWith("app:get-info");
  });

  it("rejects a response that does not match the contract", async () => {
    const api = apiWith(async () => ({ name: 42 }));

    await expect(api.app.getInfo()).rejects.toThrow();
  });

  it("calls the site channels and returns their parsed results", async () => {
    const project = {
      name: "Bakery",
      fileName: "Bakery.wforge",
      formatVersion: 1,
      syncService: "onedrive",
    };
    const site = createSite({
      name: "Bakery",
      language: "en",
      homeTitle: "Home",
      notFoundTitle: "Page not found",
    });
    const responses: Record<string, unknown> = {
      "project:create": { status: "opened", project },
      "project:open": { status: "canceled" },
      "project:get-current": null,
      "project:read-site": { status: "ok", site },
      "project:commit": { status: "saved" },
    };
    const invoke = vi.fn(async (channel: string, ..._args: unknown[]) => responses[channel]);
    const api = apiWith(invoke);

    await expect(api.project.create()).resolves.toEqual({ status: "opened", project });
    await expect(api.project.open()).resolves.toEqual({ status: "canceled" });
    await expect(api.project.getCurrent()).resolves.toBeNull();
    await expect(api.project.readSite()).resolves.toEqual({ status: "ok", site });
    const changes = changedDocuments(undefined, site);
    await expect(api.project.commit(changes)).resolves.toEqual({ status: "saved" });
    expect(invoke).toHaveBeenLastCalledWith("project:commit", changes);
  });

  it("rejects a site result that does not match the contract", async () => {
    const api = apiWith(async () => ({ status: "opened", project: { path: "C:\\" } }));

    await expect(api.project.open()).rejects.toThrow();
  });

  it("rejects a site from main that is not a valid site", async () => {
    const api = apiWith(async () => ({ status: "ok", site: { formatVersion: 1 } }));

    await expect(api.project.readSite()).rejects.toThrow();
  });
});

describe("createWebforgeApi site export", () => {
  const snapshot = {
    name: "Bakery",
    language: "en",
    theme: { name: "light" },
    layout: { header: [], footer: [] },
    pages: [
      { id: "home", path: "index", title: "Home", doc: { root: { props: {} }, content: [] } },
    ],
    media: [],
  };

  it("sends the snapshot on the export channel and parses the result", async () => {
    const result = { status: "exported", folderName: "site", pages: 1, files: 5, warnings: 0 };
    const invoke = vi.fn(async () => result);
    const api = apiWith(invoke);

    await expect(api.site.export(snapshot)).resolves.toEqual(result);
    expect(invoke).toHaveBeenCalledWith("site:export", snapshot);
  });

  it("rejects an export result that leaks a path", async () => {
    const api = apiWith(async () => ({
      status: "exported",
      folderName: "site",
      path: "C:Userssamsite",
      pages: 1,
      files: 5,
      warnings: 0,
    }));

    await expect(api.site.export(snapshot)).rejects.toThrow();
  });

  it("reads and remembers the editor mode through the project UI-state channels", async () => {
    const invoke = vi.fn(async (channel: string) =>
      channel === "project:get-ui-state" ? { editorMode: "content" } : { status: "saved" },
    );
    const api = apiWith(invoke);

    await expect(api.project.getUiState()).resolves.toEqual({ editorMode: "content" });
    await expect(api.project.setUiState({ editorMode: "design" })).resolves.toEqual({
      status: "saved",
    });
    expect(invoke).toHaveBeenLastCalledWith("project:set-ui-state", { editorMode: "design" });
    await expect(
      apiWith(async () => ({ editorMode: "zoom" })).project.getUiState(),
    ).rejects.toThrow();
  });

  it("gets and changes the preferences through the prefs channels", async () => {
    const preferences = { theme: "light", editorLevel: "simple", panelLayout: {}, window: null };
    const invoke = vi.fn(async () => preferences);
    const api = apiWith(invoke);

    await expect(api.prefs.get()).resolves.toEqual(preferences);
    await expect(api.prefs.set({ theme: "light" })).resolves.toEqual(preferences);
    expect(invoke).toHaveBeenNthCalledWith(1, "prefs:get");
    expect(invoke).toHaveBeenNthCalledWith(2, "prefs:set", { theme: "light" });
  });

  it("imports dropped or chosen files through the media channels", async () => {
    const item = {
      id: "shop",
      hash: "a".repeat(64),
      name: "shop",
      fileName: "shop.jpg",
      kind: "image",
      mimeType: "image/jpeg",
      width: 640,
      height: 480,
      alt: "",
    };
    const result = { status: "imported", items: [item], rejected: [] };
    const invoke = vi.fn(async () => result);
    const api = apiWith(invoke);
    const files = [{ fileName: "shop.jpg", data: new Uint8Array([0xff, 0xd8]) }];

    await expect(api.media.import(files)).resolves.toEqual(result);
    await expect(api.media.choose()).resolves.toEqual(result);
    expect(invoke).toHaveBeenNthCalledWith(1, "media:import", files);
    expect(invoke).toHaveBeenNthCalledWith(2, "media:choose");
    await expect(
      apiWith(async () => ({ ...result, items: [{ ...item, hash: "x" }] })).media.choose(),
    ).rejects.toThrow();
  });
});

describe("createWebforgeApi app events", () => {
  function withEvents() {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const subscribe: Subscribe = (channel, listener) => {
      listeners.set(channel, listener);
      return () => listeners.delete(channel);
    };
    const invoke = vi.fn(async (_channel: string, ..._args: unknown[]) => null);
    return { api: createWebforgeApi(invoke, subscribe), invoke, listeners };
  }

  it("runs the save on a flush request and answers with its id", async () => {
    const { api, invoke, listeners } = withEvents();
    const save = vi.fn(async () => undefined);
    const stop = api.app.onFlushRequest(save);

    listeners.get("app:flush")?.(7);
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith("project:flushed", 7));

    expect(save).toHaveBeenCalledTimes(1);
    stop();
    expect(listeners.has("app:flush")).toBe(false);
  });

  it("answers even when saving fails, and ignores malformed requests", async () => {
    const { api, invoke, listeners } = withEvents();
    const save = vi.fn(async () => {
      throw new Error("disk full");
    });
    api.app.onFlushRequest(save);

    listeners.get("app:flush")?.("seven");
    listeners.get("app:flush")?.(3);
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith("project:flushed", 3));

    expect(save).toHaveBeenCalledTimes(1);
  });
});
