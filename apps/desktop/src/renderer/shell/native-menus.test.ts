import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCommandRegistry, electronAccelerator } from "./commands.js";
import { nativeMenusOf, syncNativeMenus } from "./native-menus.js";

describe("electronAccelerator (LF-13)", () => {
  it("writes a shortcut as Electron's menus take it", () => {
    expect(electronAccelerator("Mod+Shift+Z")).toBe("CmdOrCtrl+Shift+Z");
    expect(electronAccelerator("Mod+Plus")).toBe("CmdOrCtrl+Plus");
    expect(electronAccelerator("Mod+Alt+ArrowDown")).toBe("CmdOrCtrl+Alt+Down");
    expect(electronAccelerator("Delete")).toBe("Delete");
    expect(electronAccelerator("F2")).toBe("F2");
  });
});

describe("macOS's menu bar (LF-13)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** A registry with a File and a View command, and the app's menu bar calls. */
  function setUp() {
    // The shortcut standard gives Zoom In its keys.
    const registry = createCommandRegistry();
    const settings = vi.fn();
    registry.register({
      id: "site.settings",
      label: "Site Settings…",
      menu: "file",
      run: settings,
    });
    registry.register({ id: "view.zoomIn", label: "Zoom In", menu: "view", run: vi.fn() });
    registry.register({ id: "edit.hidden", label: "Not in a menu", run: vi.fn() });
    let chosen: (id: string) => void = () => undefined;
    const app = {
      setNativeMenus: vi.fn(async () => null),
      onRunCommand: vi.fn((run: (id: string) => void) => {
        chosen = run;
        return () => undefined;
      }),
    };
    return { registry, settings, app, choose: (id: string) => chosen(id) };
  }

  it("lists each menu's commands with their keys, leaving out empty menus and others", () => {
    const { registry } = setUp();

    expect(nativeMenusOf(registry)).toEqual([
      {
        id: "file",
        label: "File",
        items: [
          expect.objectContaining({ id: "site.settings", label: "Site Settings…", enabled: true }),
        ],
      },
      {
        id: "view",
        label: "View",
        items: [{ id: "view.zoomIn", label: "Zoom In", enabled: true, accelerator: "CmdOrCtrl+=" }],
      },
    ]);
  });

  it("sends the menus at once, then once per burst of changes, and runs what's chosen there", () => {
    const { registry, settings, app, choose } = setUp();
    const stop = syncNativeMenus(registry, app);
    expect(app.setNativeMenus).toHaveBeenCalledTimes(1);

    registry.update("site.settings", { enabled: false });
    registry.update("view.zoomIn", { enabled: false });
    vi.runAllTimers();
    expect(app.setNativeMenus).toHaveBeenCalledTimes(2);
    expect(app.setNativeMenus.mock.lastCall?.[0][0].items[0].enabled).toBe(false);

    // The same menus again aren't sent.
    registry.update("view.zoomIn", { enabled: false });
    vi.runAllTimers();
    expect(app.setNativeMenus).toHaveBeenCalledTimes(2);

    registry.update("site.settings", { enabled: true });
    choose("site.settings");
    expect(settings).toHaveBeenCalledOnce();
    stop();
  });
});
