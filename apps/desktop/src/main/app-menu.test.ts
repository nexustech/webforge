import { describe, expect, it } from "vitest";
import { applicationMenu } from "./app-menu.js";

describe("applicationMenu (F-ED-27)", () => {
  it("gives Windows and Linux no menu, so no zoom or reload keys of its own", () => {
    expect(applicationMenu("win32", false)).toBeNull();
    expect(applicationMenu("linux", false)).toBeNull();
  });

  it("keeps a Mac's app, Edit and Window menus, without the View menu's zoom keys", () => {
    const menu = applicationMenu("darwin", false);

    expect(menu).toEqual([{ role: "appMenu" }, { role: "editMenu" }, { role: "windowMenu" }]);
    expect(JSON.stringify(menu)).not.toMatch(/zoom|reload|viewMenu/i);
  });

  it("reloads and opens the developer tools in development only", () => {
    expect(applicationMenu("win32", true)).toEqual([
      { label: "Developer", submenu: [{ role: "reload" }, { role: "toggleDevTools" }] },
    ]);
    expect(applicationMenu("darwin", true)?.map((item) => item.role ?? item.label)).toEqual([
      "appMenu",
      "editMenu",
      "Developer",
      "windowMenu",
    ]);
  });
});
