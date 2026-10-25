import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NativeMenus } from "../../shared/ipc/app.js";
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
      setNativeMenus: vi.fn(async (_menus: NativeMenus) => null),
      onRunCommand: vi.fn((run: (id: string) => void) => {
        chosen = run;
        return () => undefined;
      }),
    };
    // The editor window, with or without a dialog open.
    const doc = {
      querySelector: vi.fn((): Element | null => null),
      execCommand: vi.fn(() => true),
    };
    return { registry, settings, app, doc, choose: (id: string) => chosen(id) };
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

  it("lists Settings… in the application menu, not in File (LF-12)", () => {
    const { registry } = setUp();
    registry.register({ id: "app.settings", label: "Settings…", menu: "file", run: vi.fn() });

    const menus = nativeMenusOf(registry);
    expect(menus[0]).toEqual({
      id: "app",
      label: "Webforge",
      items: [
        { id: "app.settings", label: "Settings…", enabled: true, accelerator: "CmdOrCtrl+," },
      ],
    });
    expect(menus.find((menu) => menu.id === "file")?.items.map((item) => item.id)).toEqual([
      "site.settings",
    ]);
  });

  it("sends the menus at once, then once per burst of changes, and runs what's chosen there", () => {
    const { registry, settings, app, doc, choose } = setUp();
    const stop = syncNativeMenus(registry, app, doc);
    expect(app.setNativeMenus).toHaveBeenCalledTimes(1);

    registry.update("site.settings", { enabled: false });
    registry.update("view.zoomIn", { enabled: false });
    vi.runAllTimers();
    expect(app.setNativeMenus).toHaveBeenCalledTimes(2);
    expect(app.setNativeMenus.mock.lastCall?.[0][0]?.items[0]?.enabled).toBe(false);

    // The same menus again aren't sent.
    registry.update("view.zoomIn", { enabled: false });
    vi.runAllTimers();
    expect(app.setNativeMenus).toHaveBeenCalledTimes(2);

    registry.update("site.settings", { enabled: true });
    choose("site.settings");
    expect(settings).toHaveBeenCalledOnce();
    stop();
  });

  it("leaves a dialog its keys: no command runs, and Undo and Redo are its text's", () => {
    const { registry, settings, app, doc, choose } = setUp();
    const undo = vi.fn();
    registry.register({ id: "edit.undo", label: "Undo", menu: "edit", run: undo });
    const stop = syncNativeMenus(registry, app, doc);
    doc.querySelector.mockReturnValue({} as Element);

    choose("site.settings");
    choose("edit.undo");
    choose("edit.redo");
    expect(settings).not.toHaveBeenCalled();
    expect(undo).not.toHaveBeenCalled();
    expect(doc.execCommand.mock.calls).toEqual([["undo"], ["redo"]]);

    // The dialog closed: the site's Undo again.
    doc.querySelector.mockReturnValue(null);
    choose("edit.undo");
    expect(undo).toHaveBeenCalledOnce();
    stop();
  });
});
