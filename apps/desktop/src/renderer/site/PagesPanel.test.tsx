// @vitest-environment happy-dom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CollectionId, PageId, SiteDoc } from "@webforge/model";
import { scaledTestTimeout } from "@webforge/test-utils/renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { insertBlog, insertPost } from "./blog-actions.js";
import { PagesPanel, type PagesPanelActions } from "./PagesPanel.js";

afterEach(cleanup);
// Menus, sub-menus and dialogs take many user-event steps; under a full parallel run they can take
// longer than the default 5 s.
vi.setConfig({ testTimeout: scaledTestTimeout(20_000) });

/** The starter site plus About (hidden from navigation) and Team in a folder, a draft. */
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
      [team]: {
        ...page,
        id: team,
        slug: "team",
        folder: "company",
        title: "Team",
        settings: { ...page.settings, draft: true },
      },
    },
    pageOrder: [site.homePageId, about, team, ...site.pageOrder.slice(1)],
  };
}

/**
 * The panel on {@link siteWithPages}, with the site's back-to-top button if `backToTop`, Google
 * Analytics on if `analytics`, and as for a site that has been published if `published`.
 */
function setUp({ backToTop = false, analytics = false, published = false } = {}) {
  const site = siteWithPages();
  if (backToTop) site.settings.general.backToTop = true;
  if (analytics) site.settings.analytics.measurementId = "G-ABC123DEF4";
  const actions: PagesPanelActions = {
    show: vi.fn(),
    add: vi.fn(),
    addSuggested: vi.fn(),
    addPolicy: vi.fn(),
    addBlog: vi.fn(),
    addPost: vi.fn(),
    importPosts: vi.fn(),
    renameBlog: vi.fn(),
    removeBlog: vi.fn(),
    rename: vi.fn(),
    duplicate: vi.fn(),
    move: vi.fn(),
    moveToFolder: vi.fn(),
    setHome: vi.fn(),
    setHidden: vi.fn(),
    setDraft: vi.fn(),
    remove: vi.fn(),
    changeSettings: vi.fn(),
  };
  render(
    <PagesPanel
      site={site}
      shownPageId={site.homePageId}
      published={published}
      actions={actions}
    />,
  );
  const notFound = site.pageOrder.at(-1) as PageId;
  return { site, actions, notFound };
}

const openMenu = (name: string) =>
  userEvent.click(screen.getByRole("button", { name: `Actions for ${name}` }));

describe("PagesPanel (F-ED-13)", () => {
  it("lists the pages in order, with the Home page, hidden pages, drafts and folders marked", async () => {
    const { actions } = setUp();

    const list = screen.getByRole("list", { name: "Pages" });
    const names = within(list)
      .getAllByRole("button", { name: /^(?!Actions)/ })
      .map((button) => button.textContent);
    expect(names).toEqual([
      "My site(Home page)",
      "About(Hidden from navigation)",
      "TeamDraft",
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
    await userEvent.click(screen.getByRole("menuitem", { name: "Blank Page…" }));
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

  it("adds the privacy page from Add Page's menu (#855)", async () => {
    const { actions } = setUp();

    await userEvent.click(screen.getByRole("button", { name: "Add Page" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Privacy Page" }));

    expect(actions.addPolicy).toHaveBeenCalledExactlyOnceWith("privacy");
    expect(actions.add).not.toHaveBeenCalled();
  });

  it("adds the terms page from Add Page's menu, and the cookie policy only with Google Analytics (#866)", async () => {
    const { actions } = setUp();

    await userEvent.click(screen.getByRole("button", { name: "Add Page" }));
    expect(screen.queryByRole("menuitem", { name: "Cookie Policy Page" })).toBeNull();
    await userEvent.click(screen.getByRole("menuitem", { name: "Terms Page" }));

    expect(actions.addPolicy).toHaveBeenCalledExactlyOnceWith("terms");
  });

  it("offers the cookie policy while Google Analytics is on (#866)", async () => {
    const { actions } = setUp({ analytics: true });

    await userEvent.click(screen.getByRole("button", { name: "Add Page" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Cookie Policy Page" }));

    expect(actions.addPolicy).toHaveBeenCalledExactlyOnceWith("cookies");
  });

  it("adds a suggested page for a business type, from Add Page's menu (QS-3)", async () => {
    const { actions } = setUp();

    await userEvent.click(screen.getByRole("button", { name: "Add Page" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Suggested Pages" }));
    // Every business type, as the site doesn't keep the template it started from.
    for (const type of ["Food and drink", "Beauty", "Trades", "Personal"]) {
      expect(screen.getByRole("menuitem", { name: type })).toBeTruthy();
    }
    await userEvent.click(screen.getByRole("menuitem", { name: "Trades" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Areas we cover" }));

    expect(actions.addSuggested).toHaveBeenCalledWith("trades-areas");
    expect(actions.add).not.toHaveBeenCalled();
  });

  it("renames a page from its menu, typing straight into the dialog", async () => {
    const { actions } = setUp();

    await openMenu("Team");
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename…" }));
    // The dialog opens once the menu has closed, with its field focused and its text selected:
    // typing replaces the name without a click. (happy-dom doesn't take focus back as a closing
    // menu does in the app; pages.spec.ts checks that in the real app.)
    const field = await screen.findByRole("textbox", { name: "Page name" });
    expect((field as HTMLInputElement).value).toBe("Team");
    expect(document.activeElement).toBe(field);
    await userEvent.keyboard("Our team");
    expect(screen.getByText("File name: company/our-team.html")).toBeTruthy();
    // Not published yet: the old address isn't kept unless asked.
    expect(screen.getByRole("checkbox", { name: "Keep the old address working" })).toHaveProperty(
      "checked",
      false,
    );
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));

    expect(actions.rename).toHaveBeenCalledWith("page-team", "Our team", false);
  });

  it("keeps a published page's old address on rename unless told not to (#862)", async () => {
    const { actions } = setUp({ published: true });

    await openMenu("Team");
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename…" }));
    await screen.findByRole("textbox", { name: "Page name" });
    // The same file name: nothing to keep.
    expect(screen.queryByRole("checkbox", { name: "Keep the old address working" })).toBeNull();
    await userEvent.keyboard("Our team");
    const keep = screen.getByRole("checkbox", { name: "Keep the old address working" });
    expect(keep).toHaveProperty("checked", true);
    expect(screen.getByText(/that use company\/team\.html go on/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect(actions.rename).toHaveBeenLastCalledWith("page-team", "Our team", true);

    await openMenu("Team");
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename…" }));
    await screen.findByRole("textbox", { name: "Page name" });
    await userEvent.keyboard("Crew");
    await userEvent.click(screen.getByRole("checkbox", { name: "Keep the old address working" }));
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect(actions.rename).toHaveBeenLastCalledWith("page-team", "Crew", false);
  });

  it("asks to delete a page from its menu, the action confirming it (D5, D7)", async () => {
    const { actions } = setUp();

    await openMenu("About");
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete…" }));

    // The site-wide confirmation, with the pages it changes, is the action's (SitePanel).
    await vi.waitFor(() => expect(actions.remove).toHaveBeenCalledWith("page-about"));
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
    await openMenu("About");
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "Draft" }));

    expect(actions.duplicate).toHaveBeenCalledWith("page-about");
    expect(actions.setDraft).toHaveBeenCalledWith("page-about", true);
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
      // Made file-friendly before the model checks it (2.21).
      slug: "our-team",
      description: "Who we are",
      shareImage: undefined,
      hideHeader: false,
      hideFooter: true,
      hideFromNavigation: false,
      hideBackToTop: false,
      hideFromSearch: false,
      privacy: false,
      // A draft, as it was (G37): its switch was on.
      draft: true,
    });
    expect(within(dialog).getByRole("checkbox", { name: /^Draft/ })).toBeTruthy();
    // The site has no back-to-top button to leave off.
    expect(within(dialog).queryByRole("checkbox", { name: /back-to-top/ })).toBeNull();
  });

  it("leaves the site's back-to-top button off a page (F-CM-9)", async () => {
    const { actions } = setUp({ backToTop: true });

    await openMenu("Team");
    await userEvent.click(screen.getByRole("menuitem", { name: "Page Settings…" }));
    const dialog = screen.getByRole("dialog", { name: "Settings for 'Team'" });
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Hide the back-to-top button on this page" }),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(actions.changeSettings).toHaveBeenCalledWith(
      "page-team",
      expect.objectContaining({ hideBackToTop: true }),
    );
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

describe("PagesPanel with a Blog (6.10a)", () => {
  const actions = (): PagesPanelActions => ({
    show: vi.fn(),
    add: vi.fn(),
    addSuggested: vi.fn(),
    addPolicy: vi.fn(),
    addBlog: vi.fn(),
    addPost: vi.fn(),
    importPosts: vi.fn(),
    renameBlog: vi.fn(),
    removeBlog: vi.fn(),
    rename: vi.fn(),
    duplicate: vi.fn(),
    move: vi.fn(),
    moveToFolder: vi.fn(),
    setHome: vi.fn(),
    setHidden: vi.fn(),
    setDraft: vi.fn(),
    remove: vi.fn(),
    changeSettings: vi.fn(),
  });

  it("adds a Blog from Add Page's menu while the site has none", async () => {
    const panel = actions();
    render(
      <PagesPanel site={starterSite()} shownPageId={starterSite().homePageId} actions={panel} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Add Page" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Blog" }));

    expect(panel.addBlog).toHaveBeenCalledOnce();
  });

  it("lists the Blog's posts in a group, newest first, with New Post and no Move Up", async () => {
    const site = starterSite();
    const blog = "blog" as CollectionId;
    insertBlog(site, blog, "first" as PageId, "2026-01-05");
    insertPost(site, blog, "later" as PageId, "Spring opening", {}, "2026-03-01");
    const panel = actions();
    render(<PagesPanel site={site} shownPageId={site.homePageId} actions={panel} />);

    const posts = within(screen.getByRole("list", { name: "Blog" }))
      .getAllByRole("button", { name: /^(?!Actions)/ })
      .map((button) => button.textContent);
    expect(posts).toEqual(["Spring opening", "Our first post"]);
    await userEvent.click(screen.getByRole("button", { name: "New Post (Blog)" }));
    expect(panel.addPost).toHaveBeenCalledExactlyOnceWith(blog);

    await openMenu("Spring opening");
    expect(screen.queryByRole("menuitem", { name: "Move Up" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /Move to Folder/ })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Set as Home Page" })).toBeNull();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Add Page" }));
    expect(screen.queryByRole("menuitem", { name: "Blog" })).toBeNull();
  });

  it("renames the Blog from its menu, offering to move its posts to the new name's folder (#937)", async () => {
    const site = starterSite();
    const blog = "blog" as CollectionId;
    insertBlog(site, blog, "first" as PageId, "2026-01-05");
    const panel = actions();
    const { rerender } = render(
      <PagesPanel site={site} shownPageId={site.homePageId} actions={panel} />,
    );

    await openMenu("Blog");
    // It has a post, so it can't be deleted.
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "New Post",
      "Import Posts…",
      "Rename…",
    ]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename…" }));
    const dialog = screen.getByRole("dialog", { name: "Rename Blog" });
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    // The same name gives the same folder: nothing to offer.
    expect(within(dialog).queryByRole("checkbox")).toBeNull();
    await userEvent.clear(name);
    await userEvent.type(name, "News");
    const move = within(dialog).getByRole("checkbox", {
      name: "Move its posts to a folder of the new name",
    });
    // Never published: moved by default, nothing out there to keep.
    expect(move.getAttribute("aria-checked") ?? String((move as HTMLInputElement).checked)).toBe(
      "true",
    );
    expect(dialog.textContent).toContain("Each post's address changes from blog/… to news/….");
    await userEvent.click(within(dialog).getByRole("button", { name: "Rename" }));
    expect(panel.renameBlog).toHaveBeenCalledExactlyOnceWith(blog, "News", true);

    // Once published, the posts stay where they are unless asked, and their old addresses are kept.
    rerender(<PagesPanel site={site} shownPageId={site.homePageId} published actions={panel} />);
    await openMenu("Blog");
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename…" }));
    const again = screen.getByRole("dialog", { name: "Rename Blog" });
    await userEvent.clear(within(again).getByRole("textbox", { name: "Name" }));
    await userEvent.type(within(again).getByRole("textbox", { name: "Name" }), "Journal");
    expect(again.textContent).toContain("go on to the new ones");
    await userEvent.click(within(again).getByRole("button", { name: "Rename" }));
    expect(panel.renameBlog).toHaveBeenLastCalledWith(blog, "Journal", false);
  });

  it("deletes a Blog with no posts from its menu, after asking (#937)", async () => {
    const site = starterSite();
    const blog = "blog" as CollectionId;
    insertBlog(site, blog, "first" as PageId, "2026-01-05");
    const empty: SiteDoc = {
      ...site,
      pages: Object.fromEntries(Object.entries(site.pages).filter(([id]) => id !== "first")),
      pageOrder: site.pageOrder.filter((id) => id !== "first"),
    };
    const panel = actions();
    render(<PagesPanel site={empty} shownPageId={empty.homePageId} actions={panel} />);

    await openMenu("Blog");
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    const asked = screen.getByRole("alertdialog", { name: "Delete blog 'Blog'?" });
    await userEvent.click(within(asked).getByRole("button", { name: "Cancel" }));
    expect(panel.removeBlog).not.toHaveBeenCalled();

    await openMenu("Blog");
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete Blog" }),
    );
    expect(panel.removeBlog).toHaveBeenCalledExactlyOnceWith(blog);
  });
});
