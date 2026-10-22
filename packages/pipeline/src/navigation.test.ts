import type { MenuItemId, PageId, SitePage, SiteSnapshot } from "@webforge/model";
import { sampleSite } from "@webforge/test-utils";
import { describe, expect, it } from "vitest";
import { navigationFor } from "./navigation.js";

const id = (value: string) => value as MenuItemId;
const page = (pageId: string) => pageId as PageId;

/** The fixture with a Team page in a folder, hidden from navigation in its Page Settings. */
function site(menu?: SiteSnapshot["menu"]): SiteSnapshot {
  const base = sampleSite();
  const team: SitePage = {
    id: page("team"),
    path: "company/team",
    title: "Team",
    navLabel: "Our team",
    hideFromNavigation: true,
    doc: { root: { props: {} }, content: [] },
  };
  return { ...base, pages: [...base.pages, team], menu };
}

/** The navigation on page `path`, and the broken links reported while making it. */
function navigation(snapshot: SiteSnapshot, path = "index") {
  const shown = snapshot.pages.find((candidate) => candidate.path === path);
  if (shown === undefined) throw new Error(`no page ${path}`);
  const broken: string[] = [];
  const prefix = "../".repeat(path.split("/").length - 1);
  return { items: navigationFor(snapshot, shown, prefix, (detail) => broken.push(detail)), broken };
}

describe("navigationFor (F-ED-17)", () => {
  it("lists the pages in order without a menu, leaving hidden ones out", () => {
    expect(navigation(site()).items).toEqual([
      { label: "Home", href: "index.html", current: true },
      { label: "About us", href: "about.html", current: false },
    ]);
  });

  it("follows the menu: names, buttons, new tabs, dropdowns, and URLs from the page shown", () => {
    const { items } = navigation(site(sampleSite().menu), "about");

    expect(items).toEqual([
      { label: "Home", href: "index.html", current: false },
      { label: "About us", href: "about.html", current: true },
      {
        label: "Visit us",
        current: false,
        children: [
          { label: "Questions", href: "index.html#questions", current: false },
          { label: "Find us", href: "https://example.com/map", current: false, newTab: true },
        ],
      },
      { label: "Order a cake", href: "about.html", current: true, button: true },
    ]);
  });

  it("leaves out hidden items, pages hidden in Page Settings, links to deleted pages and empty dropdowns", () => {
    const { items, broken } = navigation(
      site({
        follows: "custom",
        items: [
          { id: id("home"), kind: "page", pageId: page("home"), label: "Start", hidden: false },
          // Hidden in the menu, and hidden in its Page Settings: both left out.
          { id: id("about"), kind: "page", pageId: page("about"), hidden: true },
          { id: id("team"), kind: "page", pageId: page("team"), hidden: false },
          {
            id: id("more"),
            kind: "group",
            label: "More",
            hidden: false,
            children: [
              {
                id: id("gone"),
                kind: "link",
                label: "Old page",
                link: { kind: "page", pageId: page("deleted") },
                hidden: false,
              },
            ],
          },
          {
            id: id("shut"),
            kind: "group",
            label: "Hidden",
            hidden: true,
            children: [{ id: id("home2"), kind: "page", pageId: page("home"), hidden: false }],
          },
        ],
      }),
      "company/team",
    );

    expect(items).toEqual([{ label: "Start", href: "../index.html", current: false }]);
    expect(broken).toEqual(["deleted"]);
  });

  it("marks a dropdown current when one of its links is the page shown", () => {
    const { items } = navigation(
      site({
        follows: "custom",
        items: [
          {
            id: id("more"),
            kind: "group",
            label: "More",
            hidden: false,
            children: [{ id: id("about"), kind: "page", pageId: page("about"), hidden: false }],
          },
        ],
      }),
      "about",
    );

    expect(items[0]).toMatchObject({ current: true, children: [{ current: true }] });
  });
});
