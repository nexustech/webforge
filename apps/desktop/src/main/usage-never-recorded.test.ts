import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_THEME, type SiteSnapshot } from "@webforge/model";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExportOutcome } from "../shared/export-worker-protocol.js";
import { registerExportHandlers } from "./export-ipc.js";
import { registerMediaHandlers } from "./media-ipc.js";
import { registerProjectHandlers } from "./project-ipc.js";
import type { ProjectSession } from "./project-session.js";
import { registerPublishRun } from "./publish-run.js";
import { setUsageSink } from "./usage.js";
import { usageFeature } from "./usage-feature.js";
import { createUsageSummary, USAGE_FILE } from "./usage-summary.js";

// The usage summary has no place for free text (BD-1): a site's name, its words and a file's name
// go through every call that counts something, and must reach no line of the file. A marker in
// each is looked for after a site is made, edited, exported, published and given files.
const MARKER = "test-only-marker-5d81ce";

const tempDir = tempDirFactory();
const APP_URL = "webforge-app://editor/index.html";
const SESSION = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  setUsageSink();
});

/** An `ipcMain` that keeps the handlers, and calls one as the editor's window would. */
function fakeIpc() {
  const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>();
  const ipc = {
    handle: (channel: string, handler: never) => handlers.set(channel, handler),
  } as unknown as Pick<IpcMain, "handle">;
  const invoke = async (channel: string, ...args: unknown[]) => {
    const handler = handlers.get(channel);
    if (handler === undefined) throw new Error(`No handler for ${channel}`);
    return handler({ senderFrame: { url: APP_URL } } as IpcMainInvokeEvent, ...args);
  };
  return { ipc, invoke };
}

const snapshot: SiteSnapshot = {
  name: `${MARKER} Bakery`,
  language: "en",
  theme: { ...DEFAULT_THEME, preset: "light" },
  layout: { header: [], footer: [] },
  pages: [
    {
      id: "home",
      path: "index",
      title: `${MARKER} Home`,
      doc: {
        root: { props: {} },
        content: [{ type: "Text", props: { id: "text", text: `<p>${MARKER}</p>` } }],
      },
    },
  ],
  media: [],
};

describe("the usage summary holds nothing of a site (BD-1)", () => {
  it("not its name, its words nor a file's name, made, edited, exported and published", async () => {
    const dir = tempDir();
    const summary = createUsageSummary({
      dir,
      lists: async () => ({ components: ["Text"], rules: [], tools: [] }),
    });
    const { ipc, invoke } = fakeIpc();
    const trusted = (url: string) => url === APP_URL;
    const feature = usageFeature(summary, () => 1500);
    feature.register?.(ipc, trusted);
    feature.started?.();

    // Made: named, and told about, with the marker.
    const project = {
      sessionId: SESSION,
      name: snapshot.name,
      fileName: `${MARKER}.wforge`,
      formatVersion: 17,
      syncService: null,
    };
    const session = {
      create: vi.fn(async () => ({ status: "opened", project })),
      staleReason: () => undefined,
      commit: vi.fn(async () => ({ status: "failed", reason: "read-only" })),
      forSession: () => ({}),
    };
    registerProjectHandlers(ipc, trusted, session as unknown as ProjectSession, {
      chooseNewProjectPath: async () => `/sites/${MARKER}.wforge`,
      chooseProjectToOpen: async () => undefined,
      chooseSiteZipToSave: async () => undefined,
      chooseSiteZipToOpen: async () => undefined,
    });
    await invoke("project:create", {
      name: snapshot.name,
      theme: "bistro",
      template: "cafe",
      about: `We bake for ${MARKER}`,
    });

    // Edited: its first change, and one that couldn't be saved.
    feature.site?.opened?.({} as never, `/sites/${MARKER}.wforge`);
    feature.site?.committed?.();
    await invoke("project:commit", SESSION, []);

    // Exported: once refused for a page named with the marker, once done.
    const outcomes: ExportOutcome[] = [
      { type: "failed", code: "reserved-name", detail: "reserved", page: snapshot.pages[0]?.title },
      {
        type: "exported",
        pages: 1,
        files: 3,
        bytes: 900,
        warnings: [{ code: "broken-link", page: "index", detail: MARKER }],
        warningCount: 1,
        durationMs: 80,
      },
    ];
    registerExportHandlers(ipc, trusted, {
      dialogs: {
        chooseExportFolder: async () => `/exports/${MARKER}`,
        chooseExportZip: async () => undefined,
      },
      runExport: async () => outcomes.shift() ?? { type: "cancelled" },
      sendProgress: () => undefined,
      site: () => ({
        staleReason: () => undefined,
        readMedia: async () => undefined,
        exportChoices: async () => ({
          format: "folder",
          minify: false,
          developerFiles: false,
          askWebAddress: false,
        }),
        setExportChoices: async () => undefined,
      }),
      open: async () => "opened",
      show: async () => "opened",
    });
    const exportRequest = {
      snapshot,
      media: [
        {
          id: "photo",
          name: `${MARKER}-photo`,
          mimeType: "image/jpeg",
          hash: "a".repeat(64),
          alt: MARKER,
        },
      ],
      choices: { format: "folder", minify: false, developerFiles: false, askWebAddress: false },
      output: { minify: false, developerFiles: false },
    };
    await invoke("site:export", SESSION, exportRequest, "44444444-4444-4444-8444-444444444441");
    await invoke("site:export", SESSION, exportRequest, "44444444-4444-4444-8444-444444444442");

    // Published: a failure whose error carries the marker.
    registerPublishRun(ipc, trusted, {
      site: () => ({
        withStore: async () => {
          throw new Error(`could not read ${MARKER}`);
        },
        staleReason: () => undefined,
        readMedia: async () => undefined,
        saveVersion: async () => ({ status: "failed", reason: "unknown" }),
      }),
      secrets: { signInFor: async () => undefined },
      trusted: async () => () => false,
      fontsOf: async () => ({ fonts: [], families: [] }),
      runner: { publish: vi.fn() },
      sendProgress: vi.fn(),
      versionsKept: () => 30,
      flush: async () => undefined,
      openExternal: async () => undefined,
      holdManifest: () => () => undefined,
    } as never);
    await invoke(
      "publish:publish",
      SESSION,
      "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10",
      "1d2e3f40-5b6c-4d7e-8f80-9a0b1c2d3e4f",
      { replaceOtherSite: false },
    );

    // Files: one the site couldn't take, named with the marker.
    registerMediaHandlers(
      ipc,
      trusted,
      {
        staleReason: () => undefined,
        forSession: () => ({
          importFile: async () => ({ status: "rejected", reason: "unsupported" }),
        }),
      } as never,
      { chooseMediaFiles: async () => undefined },
    );
    await invoke("media:import", SESSION, [
      { fileName: `${MARKER}.png`, data: new Uint8Array([1, 2, 3, 4]) },
    ]);

    // What the editor tells it: names shaped like a list's, but on none of its lists.
    await invoke("app:record-usage", { kind: "added", type: "Marker5d81ce" });
    await invoke("app:record-usage", { kind: "command", id: "site.export" });

    await feature.quit?.();
    const lines = readdirSync(dir)
      .filter((name) => name.endsWith(".json"))
      .flatMap((name) => readFileSync(join(dir, name), "utf8").split("\n"));

    expect(lines.join("\n")).not.toContain(MARKER);
    expect(lines.join("\n").toLowerCase()).not.toContain("marker");
    // And what it counted is there.
    const file = JSON.parse(readFileSync(join(dir, USAGE_FILE), "utf8"));
    expect(file).toMatchObject({
      sites: { started: { quickStart: 1 }, templates: { cafe: 1 }, firstEdits: 1, exports: 1 },
      failures: {
        export: { "reserved-name": 1 },
        publish: { unknown: 1 },
        save: { "read-only": 1 },
        files: { unsupported: 1 },
      },
      used: { commands: { "site.export": 1 }, added: {} },
      timings: { startup: [{ ms: 1500 }] },
    });
    expect(file.timings.export).toEqual([expect.objectContaining({ pages: 1, pictures: 1 })]);
  });
});
