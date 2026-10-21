// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PageId, SiteDoc } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterSite } from "../editor/starter-site.js";
import { PagesPanel, type PagesPanelActions } from "./PagesPanel.js";

afterEach(cleanup);
// Menus, sub-menus and dialogs take many user-event steps; under a full parallel run they can take
// longer than the default 5 s.
vi.setConfig({ testTimeout: 20_000 });

/** The starter site plus About (hidden from navigation) and Team in a folder. */
function siteWithPages(): SiteDoc {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  const about = "page-about" as PageId;
  const team = "page-team" as PageId;
  const page = { ...home, kind: "page" as const, doc: { root: { props: {} }, content: [] } };
  return {
    ...site,
    pages: {
      ...site.pages,
      [about]: {
        ...page,
        id: about,
        slug: "about",
        title: "About",
        settings: { ...page.settings, hideFromNavigation: true },
      },
      [team]: { ...page, id: team, slug: "team", folder: "company", title: "Team" },
    },
    pageOrder: [site.homePageId, about, team, ...site.pageOrder.slice(1)],
  };
}

function setUp() {
  const site = siteWithPages();
  const actions: PagesPanelActions = {
    show: vi.fn(),
    add: vi.fn(),
    rename: vi.fn(),
    duplicate: vi.fn(),
    move: vi.fn(),
    moveToFolder: vi.fn(),
    setHome: vi.fn(),
    setHidden: vi.fn(),
    remove: vi.fn(),
    changeSettings: vi.fn(),
  };
  render(<PagesPanel site={site} shownPageId={site.homePageId} actions={actions} />);
  const notFound = site.pageOrder.at(-1) as PageId;
  return { site, actions, notFound };
}

const openMenu = (name: string) =>
  userEvent.click(screen.getByRole("button", { name: `Actions for ${name}` }));

describe("PagesPanel (F-ED-13)", () => {
  it("lists the pages in order, with the Home page, hidden pages and folders marked", async () => {
    const { actions } = setUp();

    const list = screen.getByRole("list", { name: "Pages" });
    const names = within(list)
      .getAllByRole("button", { name: /^(?!Actions)/ })
      .map((button) => button.textContent);
    expect(names).toEqual([
      "My site(Home page)",
      "About(Hidden from navigation)",
      "Team",
      "Page not found(Shown when a page doesn't exist)",
    ]);
    expect(screen.getByRole("button", { name: /^My site/ }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(within(screen.getByRole("list", { name: "company" })).getByText("Team")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: /^About/ }));
    expect(actions.show).toHaveBeenCalledWith("page-about");
  });

  it("adds a page with the name typed, showing its file name", async () => {
    const { actions } = setUp();

    await userEvent.click(screen.getByRole("button", { name: "Add Page" }));
    const field = screen.getByRole("textbox", { name: "Page name" });
    expect((field as HTMLInputElement).value).toBe("New page");
    await userEvent.clear(field);
    expect((screen.getByRole("button", { name: "Add Page" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await userEvent.type(field, "Opening Times");
    expect(screen.getByText("File name: opening-times.html")).toBeTruthy();
    await userEvent.keyboard("{Enter}");

    expect(actions.add).toHaveBeenCalledWith("Opening Times");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renames a page from its menu", async () => {
    const { actions } = setUp();

    await openMenu("Team");
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename…" }));
    const field = screen.getByRole("textbox", { name: "Page name" });
    expect((field as HTMLInputElement).value).toBe("Team");
    await userEvent.clear(field);
    await userEvent.type(field, "Our team");
    expect(screen.getByText("File name: company/our-team.html")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));

    expect(actions.rename).toHaveBeenCalledWith("page-team", "Our team");
  });

  it("deletes a page only after the confirmation (D5)", async () => {
    const { actions } = setUp();

    await openMenu("About");
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete…" }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete page 'About'?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(actions.remove).not.toHaveBeenCalled();

    await openMenu("About");
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete…" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Page" }));
    expect(actions.remove).toHaveBeenCalledWith("page-about");
  });

  it("runs the other actions from a page's menu", async () => {
    const { actions } = setUp();

    await openMenu("About");
    await userEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    await openMenu("About");
    await userEvent.click(screen.getByRole("menuitem", { name: "Move Up" }));
    await openMenu("About");
    await userEvent.click(screen.getByRole("menuitem", { name: "Set as Home Page" }));
    await openMenu("About");
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "Hide from Navigation" }));

    expect(actions.duplicate).toHaveBeenCalledWith("page-about");
    expect(actions.move).toHaveBeenCalledWith("page-about", -1);
    expect(actions.setHome).toHaveBeenCalledWith("page-about");
    expect(actions.setHidden).toHaveBeenCalledWith("page-about", false);
  });

  it("moves a page into an existing or a new folder", async () => {
    const { actions } = setUp();

    await openMenu("About");
    await userEvent.click(screen.getByRole("menuitem", { name: "Move to Folder" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "company" }));
    expect(actions.moveToFolder).toHaveBeenCalledWith("page-about", "company");

    await openMenu("About");
    await userEvent.click(screen.getByRole("menuitem", { name: "Move to Folder" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "New Folder…" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Folder name" }), "Our Shop");
    expect(screen.getByText("File name: our-shop/about.html")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(actions.moveToFolder).toHaveBeenCalledWith("page-about", "Our Shop");
  });

  it("changes a page's settings in Page Settings (F-SET-2)", async () => {
    const { actions } = setUp();

    await openMenu("Team");
    await userEvent.click(screen.getByRole("menuitem", { name: "Page Settings…" }));
    const dialog = screen.getByRole("dialog", { name: "Settings for 'Team'" });
    const slug = within(dialog).getByRole("textbox", { name: "File name" });
    await userEvent.clear(slug);
    await userEvent.type(slug, "Our Team");
    expect(within(dialog).getByText("File name: company/our-team.html")).toBeTruthy();
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Description" }),
      "Who we are",
    );
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Hide the Footer on this page" }),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(actions.changeSettings).toHaveBeenCalledWith("page-team", {
      title: "Team",
      slug: "Our Team",
      description: "Who we are",
      shareImage: undefined,
      hideHeader: false,
      hideFooter: true,
      hideFromNavigation: false,
    });
  });

  it("keeps the Home page's and 'Page not found''s file names fixed", async () => {
    setUp();

    await openMenu("Page not found");
    await userEvent.click(screen.getByRole("menuitem", { name: "Page Settings…" }));
    const dialog = screen.getByRole("dialog");
    const file = within(dialog).getByRole("textbox", { name: "File name" }) as HTMLInputElement;
    expect(file.value).toBe("404.html");
    expect(file.disabled).toBe(true);
    expect(within(dialog).queryByRole("checkbox", { name: "Hide from navigation" })).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await openMenu("My site");
    await userEvent.click(screen.getByRole("menuitem", { name: "Page Settings…" }));
    expect(
      (
        within(screen.getByRole("dialog")).getByRole("textbox", {
          name: "File name",
        }) as HTMLInputElement
      ).value,
    ).toBe("index.html");
  });

  it("offers only Rename and moves for 'Page not found', and no Delete for the Home page", async () => {
    setUp();

    await openMenu("Page not found");
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toEqual(["Page Settings…", "Rename…", "Move Up", "Move Down"]);
    expect(screen.queryByRole("menuitemcheckbox")).toBeNull();
    await userEvent.keyboard("{Escape}");

    await openMenu("My site");
    expect(screen.queryByRole("menuitem", { name: "Delete…" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Move to Folder" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Move Up" }).getAttribute("aria-disabled")).toBe(
      "true",
    );
  });
});
