import { DEFAULT_THEME, type SiteSnapshot } from "@webforge/model";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import type { PreviewJob, PreviewOutcome } from "../shared/export-worker-protocol.js";
import type { SiteContent } from "../shared/ipc/site.js";
import type { PreviewBuilder } from "./preview-builder.js";
import { createPreview, type PreviewDeps, registerPreviewHandlers } from "./preview-ipc.js";
import type { PreviewBuild, PreviewServer } from "./preview-server.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

/** The site as the renderer sends it, named `name`. */
const site = (name: string): SiteContent => ({
  snapshot: {
    name,
    language: "en",
    theme: DEFAULT_THEME,
    layout: { header: [], footer: [] },
    pages: [
      { id: "home", path: "index", title: "Home", doc: { root: { props: {} }, content: [] } },
    ],
    media: [],
  },
  media: [],
  documents: [],
});

const BASE = "/0123456789abcdef0123456789abcdef/";

/** A preview over a fake server and builder, recording what they were asked. */
function previewOf(overrides: Partial<PreviewDeps> = {}) {
  const watchers: (() => void)[] = [];
  let watching = 0;
  const server = {
    base: BASE,
    listen: vi.fn(async (scope: "local" | "network") => (scope === "local" ? 5001 : 5002)),
    update: vi.fn((_build: PreviewBuild) => undefined),
    show: vi.fn((_page: string) => undefined),
    watching: () => watching,
    onWatch: (listener: () => void) => watchers.push(listener),
    failed: vi.fn(() => undefined),
    close: vi.fn(async () => undefined),
  } satisfies PreviewServer;
  let onBuilt: (outcome: PreviewOutcome) => void = () => undefined;
  const builder = {
    request: vi.fn((_job: PreviewJob) => undefined),
    close: vi.fn(() => undefined),
  } satisfies PreviewBuilder;
  const deps: PreviewDeps = {
    startServer: vi.fn(() => server),
    startBuilder: vi.fn((built) => {
      onBuilt = built;
      return builder;
    }),
    jobFor: async (snapshot: SiteSnapshot) => ({
      type: "preview",
      snapshot,
      fonts: [],
      families: [],
    }),
    openInBrowser: vi.fn(async () => true),
    networkAddress: () => "192.168.1.23",
    ...overrides,
  };
  const built = () => builder.request.mock.calls.map(([job]) => job.snapshot.name);
  return {
    preview: createPreview(deps),
    deps,
    server,
    builder,
    built,
    watch: () => {
      watching++;
      for (const watcher of watchers) watcher();
    },
    finish: (outcome: PreviewOutcome) => onBuilt(outcome),
  };
}

describe("createPreview (3.2)", () => {
  it("starts on this computer, builds the site and opens it at the page shown", async () => {
    const { preview, deps, server, built } = previewOf();

    expect(await preview.open(site("Bakery"), "services/our cakes.html")).toBe("opened");

    expect(server.listen).toHaveBeenCalledWith("local");
    expect(built()).toEqual(["Bakery"]);
    expect(deps.openInBrowser).toHaveBeenCalledWith(
      `http://127.0.0.1:5001${BASE}services/our%20cakes.html`,
    );
    // Opened again: the same server, nothing new to build.
    await preview.open(site("Bakery"), "index.html");
    expect(deps.startServer).toHaveBeenCalledOnce();
  });

  it("says so when the browser couldn't open, or the server couldn't start", async () => {
    expect(
      await previewOf({ openInBrowser: async () => false }).preview.open(site("A"), "index.html"),
    ).toBe("failed");
    const broken = previewOf();
    broken.server.listen.mockRejectedValueOnce(
      Object.assign(new Error("in use"), { code: "EADDRINUSE" }),
    );
    expect(await broken.preview.open(site("A"), "index.html")).toBe("failed");
  });

  it("builds the latest site only while a browser shows it", async () => {
    const { preview, built, watch } = previewOf();
    // Nothing to do before it's opened.
    await preview.update(site("Before"));
    expect(built()).toEqual([]);

    await preview.open(site("One"), "index.html");
    // Nobody watching yet: kept for later.
    await preview.update(site("Two"));
    await preview.update(site("Three"));
    expect(built()).toEqual(["One"]);

    // A browser starts watching: the latest is built, once.
    watch();
    watch();
    expect(built()).toEqual(["One", "Three"]);
    await preview.update(site("Four"));
    expect(built()).toEqual(["One", "Three", "Four"]);
  });

  it("never lets a site whose fonts took longer replace a later one", async () => {
    let release: () => void = () => undefined;
    const slow = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { preview, built, watch } = previewOf({
      jobFor: async (snapshot) => {
        if (snapshot.name === "Slow") await slow;
        return { type: "preview", snapshot, fonts: [], families: [] };
      },
    });
    await preview.open(site("One"), "index.html");
    watch();

    const late = preview.update(site("Slow"));
    await preview.update(site("Fast"));
    release();
    await late;

    expect(built()).toEqual(["One", "Fast"]);
  });

  it("serves each build, and follows the editor to the page shown", async () => {
    const { preview, server, finish } = previewOf();
    await preview.open(site("One"), "index.html");
    const build: PreviewBuild = { type: "previewed", full: true, changed: [], removed: [] };

    finish(build);
    finish({ type: "preview-failed", detail: "missing-font" });
    preview.show("about.html");

    expect(server.update.mock.calls).toEqual([[build]]);
    // A failed build answers the pages waiting for the first one at once.
    expect(server.failed).toHaveBeenCalledOnce();
    expect(server.show).toHaveBeenCalledWith("about.html");
  });

  it("gives a phone its address on the network, or says there's no network", async () => {
    const { preview, server, built } = previewOf();
    expect(await preview.phone(site("Bakery"), "about.html")).toEqual({
      status: "ready",
      url: `http://192.168.1.23:5002${BASE}about.html`,
    });
    expect(server.listen).toHaveBeenCalledWith("network");
    expect(built()).toEqual(["Bakery"]);

    const offline = previewOf({ networkAddress: () => undefined });
    expect(await offline.preview.phone(site("Bakery"), "index.html")).toEqual({
      status: "offline",
    });
    expect(offline.server.listen).not.toHaveBeenCalled();
  });

  it("stops the server and the builder when closed; the next open starts afresh", async () => {
    const { preview, deps, server, builder, built } = previewOf();
    await preview.open(site("One"), "index.html");

    await preview.close();
    expect(builder.close).toHaveBeenCalled();
    expect(server.close).toHaveBeenCalled();
    await preview.update(site("Two"));
    expect(built()).toEqual(["One"]);

    await preview.open(site("Three"), "index.html");
    expect(deps.startServer).toHaveBeenCalledTimes(2);
  });
});

describe("registerPreviewHandlers (3.2)", () => {
  /** The handler of `channel` over `preview`, called as from a renderer `trusted` says it trusts. */
  function invoker(channel: string, trusted = true) {
    const registered = new Map<string, Handler>();
    const ipc = {
      handle: (name: string, handler: Handler) => registered.set(name, handler),
    } as unknown as Pick<IpcMain, "handle">;
    const made = previewOf();
    registerPreviewHandlers(ipc, () => trusted, made.preview);
    return {
      ...made,
      call: (...args: unknown[]) =>
        registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args),
    };
  }

  it("opens the preview at a page of its own, never anywhere else", async () => {
    const { call, deps } = invoker("preview:open");
    expect(await call(site("Bakery"), "about.html")).toBe("opened");

    for (const page of [
      "../secret.html",
      "/etc/passwd.html",
      "https://example.com/a.html",
      "a.txt",
    ]) {
      await expect(call(site("Bakery"), page), page).rejects.toThrow();
    }
    expect(deps.openInBrowser).toHaveBeenCalledOnce();
  });

  it("takes changes and the page shown", async () => {
    const update = invoker("preview:update");
    expect(await update.call(site("Bakery"))).toBe(null);
    const show = invoker("preview:show");
    expect(await show.call("about.html")).toBe(null);
  });

  it("refuses a renderer it does not trust", async () => {
    await expect(invoker("preview:open", false).call(site("A"), "index.html")).rejects.toThrow();
  });
});
