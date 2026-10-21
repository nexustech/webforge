import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { MenuItemId, PageId } from "./ids.js";
import type { MenuItem } from "./menu.js";
import { syncMenuWithPages } from "./menu-sync.js";
import { createSite, type SiteDoc } from "./site-doc.js";

const ABOUT = "page-about" as PageId;
const MENU = (id: string) => id as MenuItemId;

/** A new site with an About page after the home page. */
function site(): SiteDoc {
  const base = createSite({
    name: "Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Missing",
  });
  const home = base.pages[base.homePageId];
  if (home === undefined) throw new Error("no home page");
  base.pages[ABOUT] = { ...structuredClone(home), id: ABOUT, slug: "about", title: "About" };
  base.pageOrder.splice(1, 0, ABOUT);
  return base;
}

/** The pages a menu lists, in its order, groups included. */
const pagesIn = (items: readonly MenuItem[]): PageId[] =>
  items.flatMap((item) =>
    item.kind === "page" ? [item.pageId] : item.kind === "group" ? pagesIn(item.children) : [],
  );

describe("syncMenuWithPages (F-ED-17)", () => {
  it("lists the pages in order while it follows them, keeping each page's item", () => {
    const doc = site();
    const homeItem = doc.menu.items[0];

    const menu = syncMenuWithPages(doc);

    expect(menu.follows).toBe("pages");
    expect(pagesIn(menu.items)).toEqual([doc.homePageId, ABOUT]);
    expect(menu.items[0]).toBe(homeItem);
    // "Page not found" is never in the menu.
    expect(pagesIn(menu.items)).not.toContain(doc.notFoundPageId);
  });

  it("once edited, drops what was on deleted pages and adds a new page at the end", () => {
    const doc = site();
    doc.menu = {
      follows: "custom",
      items: [
        {
          id: MENU("book"),
          kind: "button",
          label: "Book now",
          link: { kind: "url", href: "https://x.example" },
          hidden: false,
        },
        {
          id: MENU("more"),
          kind: "group",
          label: "More",
          hidden: false,
          children: [
            { id: MENU("about"), kind: "page", pageId: ABOUT, hidden: true },
            {
              id: MENU("hours"),
              kind: "section",
              label: "Hours",
              link: { kind: "page", pageId: ABOUT, anchor: "hours" },
              hidden: false,
            },
            {
              id: MENU("mail"),
              kind: "link",
              label: "Mail",
              link: { kind: "email", address: "a@b.example" },
              hidden: false,
            },
          ],
        },
        { id: MENU("home"), kind: "page", pageId: doc.homePageId, hidden: false },
      ],
    };
    delete doc.pages[ABOUT];
    doc.pageOrder = doc.pageOrder.filter((id) => id !== ABOUT);
    const added = "page-new" as PageId;
    const home = doc.pages[doc.homePageId];
    if (home === undefined) throw new Error("no home page");
    doc.pages[added] = { ...structuredClone(home), id: added, slug: "new", title: "New" };
    doc.pageOrder.push(added);

    const menu = syncMenuWithPages(doc, added);

    expect(menu.items.map((item) => item.id).slice(0, 3)).toEqual(["book", "more", "home"]);
    expect(menu.items[1]).toMatchObject({ children: [{ id: "mail" }] });
    expect(menu.items[3]).toMatchObject({ kind: "page", pageId: added, hidden: false });
    // A page already listed, or "Page not found", isn't added again.
    expect(syncMenuWithPages({ ...doc, menu }, added).items).toHaveLength(4);
    expect(syncMenuWithPages({ ...doc, menu }, doc.notFoundPageId).items).toHaveLength(4);
  });

  it("keeps every page listed exactly while it follows them, and never loses custom items", () => {
    type Step = { readonly kind: "add" | "delete" | "move"; readonly at: number };
    const step = fc.record({
      kind: fc.constantFrom("add" as const, "delete" as const, "move" as const),
      at: fc.nat(10),
    });
    fc.assert(
      fc.property(fc.boolean(), fc.array(step, { maxLength: 12 }), (custom, steps: Step[]) => {
        const doc = site();
        doc.menu = syncMenuWithPages(doc);
        if (custom) {
          // Edited: a button added after every page.
          doc.menu = {
            follows: "custom",
            items: [
              ...doc.menu.items,
              {
                id: MENU("book"),
                kind: "button",
                label: "Book",
                link: { kind: "url", href: "https://x.example" },
                hidden: false,
              },
            ],
          };
        }
        const home = doc.pages[doc.homePageId];
        if (home === undefined) throw new Error("no home page");
        let count = 0;
        for (const { kind, at } of steps) {
          const pages = doc.pageOrder.filter(
            (id) => doc.pages[id]?.kind === "page" && id !== doc.homePageId,
          );
          if (kind === "add") {
            const id = `page-${count++}` as PageId;
            doc.pages[id] = { ...structuredClone(home), id, slug: `p${count}`, title: `P${count}` };
            doc.pageOrder.splice(Math.min(at, doc.pageOrder.length), 0, id);
            doc.menu = syncMenuWithPages(doc, id);
          } else if (kind === "delete" && pages.length > 0) {
            const id = pages[at % pages.length] as PageId;
            delete doc.pages[id];
            doc.pageOrder = doc.pageOrder.filter((other) => other !== id);
            doc.menu = syncMenuWithPages(doc);
          } else if (kind === "move" && doc.pageOrder.length > 1) {
            const [moved] = doc.pageOrder.splice(at % doc.pageOrder.length, 1);
            doc.pageOrder.splice(at % doc.pageOrder.length, 0, moved as PageId);
            doc.menu = syncMenuWithPages(doc);
          }
        }

        const listed = pagesIn(doc.menu.items);
        const real = doc.pageOrder.filter((id) => doc.pages[id]?.kind === "page");
        // Every page is listed once; nothing listed is gone.
        expect(listed.toSorted()).toEqual(real.toSorted());
        if (!custom) {
          expect(listed).toEqual(real);
        } else {
          expect(doc.menu.items.some((item) => item.id === "book")).toBe(true);
        }
        const ids = doc.menu.items.map((item) => item.id);
        expect(new Set(ids).size).toBe(ids.length);
      }),
    );
  });
});
