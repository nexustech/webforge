import type { IpcMain } from "electron";
import { describe, expect, it, vi } from "vitest";
import type { ElementClipboard } from "./clipboard.js";
import type { ProjectDialogs } from "./project-ipc.js";
import type { ProjectSession } from "./project-session.js";
import { siteCallsFeature } from "./site-calls.js";

describe("siteCallsFeature (#985)", () => {
  it("registers the open site's calls once Electron is ready, and nothing before", () => {
    const channels: string[] = [];
    const ipc = {
      handle: (channel: string) => channels.push(channel),
    } as unknown as Pick<IpcMain, "handle">;
    const feature = siteCallsFeature({
      session: {} as ProjectSession,
      dialogs: {} as ProjectDialogs,
      options: {},
      net: { request: vi.fn() },
      packaged: true,
      clipboard: {} as ElementClipboard,
      writeText: vi.fn(),
      copySecret: vi.fn(),
      choosePostFiles: vi.fn(),
    });
    expect(channels).toEqual([]);

    feature.register?.(ipc, () => true);

    expect(channels).toEqual(
      expect.arrayContaining([
        "project:open",
        "site:bundle-file",
        "clipboard:write",
        "posts:choose-files",
      ]),
    );
  });
});
