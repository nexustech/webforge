import { changedDocuments, createSite, DEFAULT_THEME } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "../shared/ipc/prefs.js";
import { createWebforgeApi, type Invoke, type Subscribe } from "./api.js";

const SESSION = "9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d";

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
      sessionId: SESSION,
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

    const request = { name: "Bakery", theme: "light" };
    await expect(api.project.create(request)).resolves.toEqual({ status: "opened", project });
    expect(invoke).toHaveBeenCalledWith("project:create", request);
    await expect(api.project.open()).resolves.toEqual({ status: "canceled" });
    await expect(api.project.getCurrent()).resolves.toBeNull();
    await expect(api.project.readSite()).resolves.toEqual({ status: "ok", site });
    const changes = changedDocuments(undefined, site);
    await expect(api.project.commit(SESSION, changes)).resolves.toEqual({ status: "saved" });
    expect(invoke).toHaveBeenLastCalledWith("project:commit", SESSION, changes);
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
    theme: { ...DEFAULT_THEME, preset: "light" },
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

    await expect(api.site.export({ snapshot, media: [] })).resolves.toEqual(result);
    expect(invoke).toHaveBeenCalledWith("site:export", { snapshot, media: [] });
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

    await expect(api.site.export({ snapshot, media: [] })).rejects.toThrow();
  });

  it("reads and remembers the editor mode through the project UI-state channels", async () => {
    const invoke = vi.fn(async (channel: string) =>
      channel === "project:get-ui-state" ? { editorMode: "content" } : { status: "saved" },
    );
    const api = apiWith(invoke);

    await expect(api.project.getUiState()).resolves.toEqual({ editorMode: "content" });
    await expect(api.project.setUiState(SESSION, { editorMode: "design" })).resolves.toEqual({
      status: "saved",
    });
    expect(invoke).toHaveBeenLastCalledWith("project:set-ui-state", SESSION, {
      editorMode: "design",
    });
    await expect(
      apiWith(async () => ({ editorMode: "zoom" })).project.getUiState(),
    ).rejects.toThrow();
  });

  it("gets and changes the preferences through the prefs channels", async () => {
    const preferences = { ...DEFAULT_PREFERENCES, theme: "light" };
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

    await expect(api.media.import(SESSION, files)).resolves.toEqual(result);
    await expect(api.media.choose(SESSION)).resolves.toEqual(result);
    expect(invoke).toHaveBeenNthCalledWith(1, "media:import", SESSION, files);
    expect(invoke).toHaveBeenNthCalledWith(2, "media:choose", SESSION);
    await expect(
      apiWith(async () => ({ ...result, items: [{ ...item, hash: "x" }] })).media.choose(SESSION),
    ).rejects.toThrow();
  });

  it("sends dropped files' paths to the main process only, saying which had none (R13b)", async () => {
    const result = { status: "imported", items: [], rejected: [] };
    const invoke = vi.fn(async () => result);
    const paths = new Map<unknown, string>();
    const file = (name: string, path: string) => {
      const made = { name } as File;
      paths.set(made, path);
      return made;
    };
    const pathOf = (dropped: File) => {
      const path = paths.get(dropped);
      if (path === undefined) throw new Error("not a dropped file");
      return path;
    };
    const api = createWebforgeApi(invoke, noEvents, pathOf);
    const files = [
      file("shop.jpg", "C:\\Photos\\shop.jpg"),
      file("from-page.png", ""),
      { name: "made.png" } as File,
    ];

    const imported = await api.media.importFiles(SESSION, files);

    expect(imported).toEqual({ result, withoutPath: [1, 2] });
    // No path comes back to the renderer.
    expect(JSON.stringify(imported)).not.toContain("Photos");
    expect(invoke).toHaveBeenCalledWith("media:import-paths", SESSION, ["C:\\Photos\\shop.jpg"]);
    invoke.mockClear();
    await expect(api.media.importFiles(SESSION, [files[1] as File])).resolves.toEqual({
      result,
      withoutPath: [0],
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("forwards nothing but getPathForFile's answers for real files: the trust boundary for paths", async () => {
    // As webUtils.getPathForFile: a path for a File the drop gave, and an error for anything else.
    const dropped = new File([new Uint8Array([1])], "shop.jpg");
    const pathOf = vi.fn((file: File) => {
      if (!(file instanceof File)) throw new TypeError("Not a File");
      return file === dropped ? "/home/sam/Photos/shop.jpg" : "";
    });
    const invoke = vi.fn(async () => ({ status: "imported", items: [], rejected: [] }));
    const api = createWebforgeApi(invoke, noEvents, pathOf);
    // What a hostile page could pass instead of files: paths of its own, or objects that say one.
    const forged = [
      "/etc/passwd",
      { name: "/etc/passwd", path: "/etc/passwd" },
      new File([], "/etc/passwd"),
    ] as unknown as File[];

    const imported = await api.media.importFiles(SESSION, [...forged, dropped]);

    expect(imported.withoutPath).toEqual([0, 1, 2]);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("media:import-paths", SESSION, [
      "/home/sam/Photos/shop.jpg",
    ]);
    // Every path sent is getPathForFile's own answer, for the very File passed.
    expect(pathOf.mock.calls.map(([file]) => file)).toEqual([...forged, dropped]);
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

describe("createWebforgeApi AI requests (4.8)", () => {
  function withEvents() {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const subscribe: Subscribe = (channel, listener) => {
      listeners.set(channel, listener);
      return () => listeners.delete(channel);
    };
    const invoke = vi.fn(async (_channel: string, ..._args: unknown[]) => null);
    return { api: createWebforgeApi(invoke, subscribe), invoke, listeners };
  }

  it("answers an AI app's request with its id, and says when it listens", async () => {
    const { api, invoke, listeners } = withEvents();
    const answer = vi.fn(async () => ({ status: "done" as const, data: { name: "Bakery" } }));
    const stop = api.ai.onRequest(answer);
    expect(invoke).toHaveBeenCalledWith("ai:listening", true);

    const request = { kind: "query", name: "outline", input: {} };
    listeners.get("ai:request")?.(4, request);
    await vi.waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("ai:answer", 4, {
        status: "done",
        data: { name: "Bakery" },
      }),
    );
    expect(answer).toHaveBeenCalledWith(request);

    stop();
    expect(listeners.has("ai:request")).toBe(false);
    expect(invoke).toHaveBeenLastCalledWith("ai:listening", false);
  });

  it("answers busy when answering fails, and ignores malformed requests", async () => {
    const { api, invoke, listeners } = withEvents();
    const answer = vi.fn(async () => {
      throw new Error("no session");
    });
    api.ai.onRequest(answer);

    listeners.get("ai:request")?.(5, { kind: "delete everything" });
    listeners.get("ai:request")?.(6, { kind: "query", name: "outline", input: {} });
    await vi.waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        "ai:answer",
        6,
        expect.objectContaining({ status: "busy" }),
      ),
    );
    expect(answer).toHaveBeenCalledTimes(1);
  });
});
