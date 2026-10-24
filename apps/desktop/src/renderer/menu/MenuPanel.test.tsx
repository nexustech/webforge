// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MENU_LABEL_MAX } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it } from "vitest";
import { createEditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { openedDialog } from "../shell/opened-dialog.test-helper.js";
import { createPanelRegistry } from "../shell/panels.js";
import { addPage, setHiddenFromNavigation } from "../site/page-actions.js";
import { registerSitePanel } from "../site/SitePanel.js";
import { addMenuItem } from "./menu-actions.js";

afterEach(cleanup);

function setUp() {
  const session = createEditorSession(siteLibrary, starterSite());
  addPage(session, "About");
  const panels = createPanelRegistry();
  const remove = registerSitePanel(panels, session);
  const SitePanel = panels.list()[0]?.component;
  if (SitePanel === undefined) throw new Error("not registered");
  render(<SitePanel />);
  const menu = () => within(screen.getByRole("region", { name: "Menu" }));
  /** The menu's rows, by their accessible names. */
  const rows = () =>
    menu()
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? "")
      .filter((name) => !name.startsWith("Actions for") && name !== "Add to Menu");
  const labels = () => session.history.entries().map((entry) => entry.label);
  const site = () => session.history.document.getState();
  // No wait between events: the dialogs redraw on every one (see LinkField.test.tsx).
  return { session, menu, rows, labels, site, remove, user: userEvent.setup({ delay: null }) };
}

describe("MenuPanel (F-ED-17)", () => {
  it("lists the pages while the menu follows them, and adds a button with its label", async () => {
    const { menu, rows, labels, site, user, remove } = setUp();
    expect(rows()).toEqual(["My site, page", "About, page"]);
    expect(menu().getByText(/The menu lists your pages in order/)).toBeTruthy();

    await user.click(menu().getByRole("button", { name: "Add to Menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Button…" }));
    // The dialog opens once the menu has closed.
    const dialog = await openedDialog("Menu button");
    await user.click(dialog.getByRole("textbox", { name: "Label" }));
    await user.paste("Book now");
    await user.click(dialog.getByRole("radio", { name: "Web address" }));
    await user.click(dialog.getByRole("textbox", { name: "Web address" }));
    await user.paste("book.example");
    await user.click(dialog.getByRole("button", { name: "Save Link" }));

    expect(rows()).toEqual(["My site, page", "About, page", "Book now, button"]);
    expect(site().menu.items[2]).toMatchObject({
      kind: "button",
      link: { kind: "url", href: "https://book.example" },
    });
    expect(labels().at(-1)).toBe("Added menu item 'Book now'");
    // Edited now: it no longer follows the pages.
    expect(menu().queryByText(/The menu lists your pages in order/)).toBeNull();
    remove();
  });

  // Apart from adding: each step redraws the panel, and together they took one test past 5 s in a
  // busy full run.
  it("follows the page order again once the menu was edited", async () => {
    const { session, menu, rows, user, remove } = setUp();
    act(() => {
      addMenuItem(session, { kind: "group", label: "More" });
    });
    expect(rows()).toEqual(["My site, page", "About, page", "More, dropdown"]);

    await user.click(menu().getByRole("button", { name: "Add to Menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Follow Page Order" }));

    expect(rows()).toEqual(["My site, page", "About, page"]);
    expect(menu().getByText(/The menu lists your pages in order/)).toBeTruthy();
    remove();
  });

  it("renames a page item by clicking it, and gives it its page's name back", async () => {
    const { menu, rows, user, remove } = setUp();

    await user.click(menu().getByRole("button", { name: "About, page" }));
    const dialog = await openedDialog("Rename menu item");
    // As long as a menu label may be, not the 200 characters a page title may (R10).
    expect(dialog.getByRole("textbox", { name: "Name in the menu" })).toHaveProperty(
      "maxLength",
      MENU_LABEL_MAX,
    );
    await user.clear(dialog.getByRole("textbox", { name: "Name in the menu" }));
    await user.paste("Our story");
    await user.click(dialog.getByRole("button", { name: "Rename" }));
    expect(rows()[1]).toBe("Our story, page");

    await user.click(menu().getByRole("button", { name: "Actions for Our story" }));
    await user.click(screen.getByRole("menuitem", { name: "Use Page Name" }));
    expect(rows()[1]).toBe("About, page");
    remove();
  });

  it("moves with Alt+arrows, hides, and removes with Delete, one step each", async () => {
    const { menu, rows, labels, user, remove } = setUp();
    const about = menu().getByRole("button", { name: "About, page" });

    about.focus();
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(rows()).toEqual(["About, page", "My site, page"]);
    // Focus stays on the moved item.
    expect(document.activeElement?.getAttribute("aria-label")).toBe("About, page");

    await user.click(menu().getByRole("button", { name: "Actions for About" }));
    await user.click(screen.getByRole("menuitem", { name: "Hide in Menu" }));
    expect(rows()[0]).toBe("About, page, hidden");

    menu().getByRole("button", { name: "My site, page" }).focus();
    await user.keyboard("{Delete}");
    expect(rows()).toEqual(["About, page, hidden"]);
    expect(labels().slice(-3)).toEqual([
      "Moved menu item 'About'",
      "Hid menu item 'About'",
      "Deleted menu item 'My site'",
    ]);
    remove();
  });

  it("shows a page hidden from navigation in its Page Settings as hidden there", () => {
    const { session, site, rows, remove } = setUp();
    const about = site().pageOrder[1];
    if (about === undefined) throw new Error("no About page");

    act(() => setHiddenFromNavigation(session, about, true));

    expect(rows()).toEqual(["My site, page", "About, page, hidden in Page Settings"]);
    remove();
  });

  it("adds a dropdown and moves items into and out of it", async () => {
    const { menu, rows, user, remove } = setUp();

    await user.click(menu().getByRole("button", { name: "Add to Menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Dropdown…" }));
    // Its field has focus, so typing goes there.
    await openedDialog("Add a dropdown");
    await user.paste("More");
    await user.click(screen.getByRole("button", { name: "Add Dropdown" }));
    await user.click(menu().getByRole("button", { name: "Actions for About" }));
    await user.click(screen.getByRole("menuitem", { name: "Move into 'More'" }));
    expect(rows()).toEqual(["My site, page", "More, dropdown", "About, page in 'More'"]);

    await user.click(menu().getByRole("button", { name: "Actions for About" }));
    // A dropdown is never offered as a place for itself or other dropdowns.
    expect(screen.queryByRole("menuitem", { name: "Move into 'More'" })).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Move out of Dropdown" }));
    expect(rows()).toEqual(["My site, page", "More, dropdown", "About, page"]);
    remove();
  });

  it("moves an item by drag, before or after another", () => {
    const { menu, rows, remove } = setUp();
    const row = (name: string) =>
      menu().getByRole("button", { name }).closest("li") as HTMLLIElement;
    const store = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "",
      get types() {
        return [...store.keys()];
      },
      setData: (type: string, value: string) => store.set(type, value),
      getData: (type: string) => store.get(type) ?? "",
    };
    // happy-dom lays nothing out: every drop lands on the lower half, "after".
    fireEvent.dragStart(row("My site, page"), { dataTransfer });
    fireEvent.dragOver(row("About, page"), { dataTransfer, clientY: 1 });
    fireEvent.drop(row("About, page"), { dataTransfer, clientY: 1 });

    expect(rows()).toEqual(["About, page", "My site, page"]);
    remove();
  });
});
