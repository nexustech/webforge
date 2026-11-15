import type { Session } from "electron";
import { describe, expect, it, vi } from "vitest";
import { APP_SCHEME } from "./app-scheme.js";
import { prepareSession, type SessionSetUp } from "./app-setup.js";
import { FONT_SCHEME } from "./fonts.js";

function setUp(options: { development: boolean; platform: NodeJS.Platform }) {
  const handled: string[] = [];
  const session = {
    protocol: { handle: (scheme: string) => handled.push(scheme) },
    setPermissionRequestHandler: vi.fn(),
    setPermissionCheckHandler: vi.fn(),
  } as unknown as Session;
  const menu = { setApplicationMenu: vi.fn(), buildFromTemplate: vi.fn(() => ({})) };
  const setUp: SessionSetUp = {
    menu: menu as unknown as SessionSetUp["menu"],
    session,
    rendererDir: "/renderer",
    fonts: { respondWithFont: vi.fn() },
    ...options,
  };
  prepareSession(setUp);
  return { handled, menu, session };
}

describe("prepareSession (#985)", () => {
  it("serves the app's pages from its scheme, and the site's fonts", () => {
    const { handled, session } = setUp({ development: false, platform: "win32" });

    expect(handled).toEqual([APP_SCHEME, FONT_SCHEME]);
    expect(session.setPermissionRequestHandler).toHaveBeenCalled();
  });

  it("leaves the app's pages to the dev server in development", () => {
    expect(setUp({ development: true, platform: "win32" }).handled).toEqual([FONT_SCHEME]);
  });

  it("takes the default menu away, whose keys are the editor's (F-ED-27)", () => {
    const { menu } = setUp({ development: false, platform: "win32" });

    expect(menu.setApplicationMenu).toHaveBeenCalledOnce();
  });
});
