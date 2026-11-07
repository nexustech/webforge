import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it, vi } from "vitest";
import { applicationMenu, runMenuCommand } from "./app-menu.js";

describe("applicationMenu (F-ED-27)", () => {
  it("gives Windows and Linux no menu, so no zoom or reload keys of its own", () => {
    expect(applicationMenu("win32", false)).toBeNull();
    expect(applicationMenu("linux", false)).toBeNull();
  });

  it("keeps a Mac's app, Edit, View and Window menus, without the zoom keys", () => {
    const menu = applicationMenu("darwin", false);

    expect(menu).toEqual([
      { role: "appMenu" },
      { role: "editMenu" },
      { label: "View", submenu: [] },
      { role: "windowMenu" },
    ]);
    expect(JSON.stringify(menu)).not.toMatch(/zoom|reload|viewMenu/i);
  });

  it("adds no full-screen item of its own: macOS adds Enter Full Screen to View itself (#525)", () => {
    const run = vi.fn();
    for (const menu of [
      applicationMenu("darwin", false),
      applicationMenu("darwin", true, {
        menus: [
          {
            id: "view",
            label: "View",
            items: [{ id: "view.zoomIn", label: "Zoom In", enabled: true }],
          },
        ],
        run,
      }),
    ]) {
      expect(menu?.find((item) => item.label === "View")).toBeDefined();
      expect(JSON.stringify(menu)).not.toMatch(/fullscreen/i);
    }
  });

  it("reloads and opens the developer tools in development only", () => {
    expect(applicationMenu("win32", true)).toEqual([
      { label: "Developer", submenu: [{ role: "reload" }, { role: "toggleDevTools" }] },
    ]);
    expect(applicationMenu("darwin", true)?.map((item) => item.role ?? item.label)).toEqual([
      "appMenu",
      "editMenu",
      "View",
      "Developer",
      "windowMenu",
    ]);
  });

  it("shows the editor's menus in a Mac's menu bar, its keys left to the editor (LF-13)", () => {
    const run = vi.fn();
    const item = (id: string, label: string, accelerator?: string) => ({
      id,
      label,
      enabled: true,
      ...(accelerator === undefined ? {} : { accelerator }),
    });
    const menu = applicationMenu("darwin", false, {
      menus: [
        { id: "file", label: "File", items: [item("site.settings", "Site Settings…")] },
        {
          id: "edit",
          label: "Edit",
          items: [item("edit.undo", "Undo", "CmdOrCtrl+Z"), item("edit.copyStyle", "Copy Style")],
        },
        { id: "view", label: "View", items: [item("view.zoomIn", "Zoom In", "CmdOrCtrl+Plus")] },
        { id: "help", label: "Help", items: [item("help.shortcuts", "Keyboard Shortcuts")] },
      ],
      run,
    });

    expect(menu?.map((each) => each.role ?? each.label)).toEqual([
      "appMenu",
      "File",
      "Edit",
      "View",
      "windowMenu",
      "help",
    ]);
    const submenu = (label: string) =>
      (menu?.find((each) => (each.role ?? each.label) === label)?.submenu ??
        []) as MenuItemConstructorOptions[];
    // Edit keeps its roles for text fields, but Undo is the editor's: it undoes the site.
    expect(submenu("Edit").map((each) => each.role ?? each.label ?? each.type)).toEqual([
      "Undo",
      "redo",
      "separator",
      "cut",
      "copy",
      "paste",
      "selectAll",
      "separator",
      "Copy Style",
    ]);
    const zoomIn = submenu("View")[0];
    expect(zoomIn).toMatchObject({
      label: "Zoom In",
      accelerator: "CmdOrCtrl+Plus",
      registerAccelerator: false,
    });
    // Undo takes the keys the page leaves (a dialog's text), so they still undo there.
    expect(submenu("Edit")[0]).toMatchObject({
      accelerator: "CmdOrCtrl+Z",
      registerAccelerator: true,
    });
    submenu("File")[0]?.click?.({} as never, undefined, {} as never);
    expect(run).toHaveBeenCalledWith("site.settings");
  });

  it("takes only Undo's and Redo's keys from the page, so no other key reaches the editor from Help (5.4b)", () => {
    const item = (id: string, accelerator: string) => ({
      id,
      label: id,
      enabled: true,
      accelerator,
    });
    const menu = applicationMenu("darwin", false, {
      menus: [
        { id: "file", label: "File", items: [item("site.export", "CmdOrCtrl+E")] },
        {
          id: "edit",
          label: "Edit",
          items: [
            item("edit.undo", "CmdOrCtrl+Z"),
            item("edit.redo", "CmdOrCtrl+Shift+Z"),
            item("edit.delete", "Backspace"),
          ],
        },
        { id: "help", label: "Help", items: [item("help.open", "F1")] },
      ],
      run: vi.fn(),
    });
    const registered = (menu ?? [])
      .flatMap((each) => (each.submenu ?? []) as MenuItemConstructorOptions[])
      .filter((each) => each.registerAccelerator === true)
      .map((each) => each.id);
    expect(registered).toEqual(["edit.undo", "edit.redo"]);
  });

  it("runs Undo and Redo in the Help window while it's in front, never in the editor behind it (5.4b)", () => {
    const help = { webContents: { undo: vi.fn(), redo: vi.fn() } };
    const editor = { webContents: { undo: vi.fn(), redo: vi.fn() } };
    const runInEditor = vi.fn();
    const run = (id: string, focused: typeof help | null) =>
      runMenuCommand(id, { focused: () => focused, isOther: (w) => w === help, runInEditor });

    run("edit.undo", help);
    run("edit.redo", help);
    expect(help.webContents.undo).toHaveBeenCalledOnce();
    expect(help.webContents.redo).toHaveBeenCalledOnce();
    expect(runInEditor).not.toHaveBeenCalled();

    // Any other command, from Help's menu bar too, is the editor's; so is Undo in the editor.
    run("site.export", help);
    run("edit.undo", editor);
    run("edit.redo", null);
    expect(runInEditor.mock.calls).toEqual([["site.export"], ["edit.undo"], ["edit.redo"]]);
    expect(editor.webContents.undo).not.toHaveBeenCalled();
  });

  it("shows a submenu of the editor's, with its separators (File › Open Recent, 3.18)", () => {
    const run = vi.fn();
    const site = "site.openRecent.".padEnd(48, "a");
    const menu = applicationMenu("darwin", false, {
      menus: [
        {
          id: "file",
          label: "File",
          items: [
            { id: "site.open", label: "Open Site…", enabled: true },
            {
              id: "site.openRecent",
              label: "Open Recent",
              enabled: true,
              submenu: [
                { id: site, label: "Rosa's Bakery", enabled: true },
                { id: "site.clearRecent", label: "Clear Recent", enabled: true, separated: true },
              ],
            },
          ],
        },
      ],
      run,
    });

    const file = (menu?.find((each) => each.label === "File")?.submenu ??
      []) as MenuItemConstructorOptions[];
    expect(file.map((each) => each.label)).toEqual(["Open Site…", "Open Recent"]);
    // The item that opens the submenu runs nothing itself.
    expect(file[1]?.click).toBeUndefined();
    const recent = (file[1]?.submenu ?? []) as MenuItemConstructorOptions[];
    expect(recent.map((each) => each.label ?? each.type)).toEqual([
      "Rosa's Bakery",
      "separator",
      "Clear Recent",
    ]);
    recent[0]?.click?.({} as never, undefined, {} as never);
    expect(run).toHaveBeenCalledWith(site);
  });

  it("puts the editor's Settings… in a Mac's application menu, after About (LF-12)", () => {
    const run = vi.fn();
    const menu = applicationMenu("darwin", false, {
      menus: [
        {
          id: "app",
          label: "Webforge",
          items: [
            { id: "app.settings", label: "Settings…", enabled: true, accelerator: "CmdOrCtrl+," },
          ],
        },
      ],
      run,
    });

    const app = (menu?.[0]?.submenu ?? []) as MenuItemConstructorOptions[];
    expect(app.map((each) => each.role ?? each.label ?? each.type)).toEqual([
      "about",
      "separator",
      "Settings…",
      "separator",
      "services",
      "separator",
      "hide",
      "hideOthers",
      "unhide",
      "separator",
      "quit",
    ]);
    app[2]?.click?.({} as never, undefined, {} as never);
    expect(run).toHaveBeenCalledWith("app.settings");
  });
});
