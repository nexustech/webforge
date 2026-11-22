import type { IpcMain } from "electron";
import { describe, expect, it, vi } from "vitest";
import type { ProjectSession } from "./project-session.js";
import { type SiteOutputDeps, siteOutput } from "./site-output.js";

/** The site's output, with nothing open and no worker that would start. */
function setUp() {
  const forkWorker = vi.fn(() => {
    throw new Error("No worker in this test");
  });
  const deps: SiteOutputDeps = {
    session: {} as ProjectSession,
    codeTrust: { trusted: vi.fn() },
    fonts: { fontsOf: vi.fn(), previewFontsOf: vi.fn() },
    dialogs: {
      export: {} as SiteOutputDeps["dialogs"]["export"],
      publish: { chooseKeyFile: vi.fn() },
      preview: { choosePageFileToSave: vi.fn() },
    },
    credentials: {} as SiteOutputDeps["credentials"],
    forkWorker,
    electron: {
      shell: { openExternal: vi.fn(), openPath: vi.fn(), showItemInFolder: vi.fn() },
    } as unknown as SiteOutputDeps["electron"],
    packaged: true,
    mainWindow: () => undefined,
    versionsKept: () => 10,
    flush: async () => undefined,
  };
  return { output: siteOutput(deps), forkWorker };
}

describe("siteOutput (#985)", () => {
  it("starts no worker until a preview, an export or a publish asks for one", () => {
    expect(setUp().forkWorker).not.toHaveBeenCalled();
  });

  it("registers the preview's, the export's and publishing's calls once Electron is ready", () => {
    const { output } = setUp();
    const channels: string[] = [];
    const ipc = {
      handle: (channel: string) => channels.push(channel),
    } as unknown as Pick<IpcMain, "handle">;

    for (const feature of Object.values(output)) feature.register?.(ipc, () => true);

    expect(channels).toEqual(
      expect.arrayContaining([
        "preview:open",
        "preview:save-page",
        "site:export",
        "publish:destinations",
        "publish:publish",
        "publish:testConnection",
        "netlify:status",
      ]),
    );
    // Each once: app.test.ts checks the same for the whole app.
    expect(new Set(channels).size).toBe(channels.length);
  });
});
