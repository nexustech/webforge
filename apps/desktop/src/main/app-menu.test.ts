import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it, vi } from "vitest";
import { applicationMenu } from "./app-menu.js";

describe("applicationMenu (F-ED-27)", () => {
  it("gives Windows and Linux no menu, so no zoom or reload keys of its own", () => {
    expect(applicationMenu("win32", false)).toBeNull();
    expect(applicationMenu("linux", false)).toBeNull();
  });

  it("keeps a Mac's app, Edit and Window menus and full screen, without the zoom keys", () => {
    const menu = applicationMenu("darwin", false);

    expect(menu).toEqual([
      { role: "appMenu" },
      { role: "editMenu" },
      { label: "View", submenu: [{ role: "togglefullscreen" }] },
      { role: "windowMenu" },
    ]);
    expect(JSON.stringify(menu)).not.toMatch(/zoom|reload|viewMenu/i);
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
    expect(submenu("View").at(-1)).toEqual({ role: "togglefullscreen" });
    submenu("File")[0]?.click?.({} as never, undefined, {} as never);
    expect(run).toHaveBeenCalledWith("site.settings");
  });
});
