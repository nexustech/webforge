import { t } from "@webforge/i18n";
import {
  canDeletePage,
  deletePageFrom,
  insertPage,
  keepingOldAddresses,
  newId,
  PAGE_DESCRIPTION_MAX,
  type PageId,
  pageNeighbour,
  pagesChangedByDeleting,
  pageTitle,
  renamePageIn,
  type SiteDoc,
  swapPages,
  tidyKeptAddresses,
} from "@webforge/model";
import { z } from "zod";
import { pageId, pageItem, pageOf } from "./command-checks.js";
import {
  type Failure,
  fail,
  failed,
  type Plan,
  type PlanContext,
  type PlanSummary,
  pageTitleOf,
  summarizeRename,
  UNPUBLISHED,
} from "./plan.js";

/** The commands that add, remove, rename, move and set pages (F-AI-1, 4.11). */
export const PAGE_COMMANDS = {
  /** Adds an empty page called `title`, before "Page not found", in the menu (asked first: D7). */
  addPage: {
    description:
      'Adds an empty page called title, before "Page not found", with a menu entry on every page: waits for the person to allow it. Answers with the new page\'s id.',
    input: z.strictObject({ title: z.string().min(1).max(200) }),
    summarize(summary: PlanSummary, _site: SiteDoc, input: { title: string }) {
      summary.pagesAdded.push(input.title.trim());
    },
    plan(site: SiteDoc, input: { title: string }): Plan | Failure {
      const title = pageTitle(input.title);
      if (title === "") return fail("invalid", "A page needs a title.");
      const id: PageId = newId("page");
      return {
        action: t("history.added", { item: t("pages.item", { name: title }) }),
        structural: true,
        kind: "insert",
        // Its menu entry changes every page (D7, 4.9).
        confirm: (app) => ({
          action: t("ai.confirm.addPage", { app, title }),
          confirm: t("ai.confirm.allow"),
          affectedPages: site.pageOrder.length,
        }),
        id,
        // A page added where an old address was kept takes it: the list loses it (#862, #925).
        recipe: (draft) => {
          insertPage(draft, id, title);
          tidyKeptAddresses(draft);
        },
      };
    },
  },
  /**
   * Deletes a page, as the person's *Delete Page* does (4.11, AIB-3): asked first, naming how many
   * pages change, as links to it elsewhere break; never the Home page or *Page not found*.
   */
  removePage: {
    description:
      'Deletes a page and its content, as the person\'s Delete Page does. It waits for the person to allow it, saying how many pages change: links to it on other pages break. Never the home page or "Page not found". One undo step.',
    input: z.strictObject({ pageId }),
    summarize(summary: PlanSummary, site: SiteDoc, input: { pageId: string }) {
      summary.pagesRemoved.push(pageTitleOf(site, input.pageId));
    },
    plan(site: SiteDoc, input: { pageId: string }): Plan | Failure {
      const page = pageOf(site, input.pageId);
      if (failed(page)) return page;
      if (!canDeletePage(site, page)) {
        return fail(
          "refused",
          page.kind === "not-found"
            ? 'The "Page not found" page can\'t be deleted.'
            : "The home page can't be deleted. Make another page the home page first.",
        );
      }
      const { id, title } = page;
      return {
        action: t("history.deleted", { item: pageItem(title) }),
        structural: true,
        kind: "remove",
        confirm: (app) => ({
          action: t("ai.confirm.removePage", { app, title }),
          description: t("pages.deleteDialog.description"),
          confirm: t("ai.confirm.allow"),
          affectedPages: pagesChangedByDeleting(site, id),
        }),
        removesPages: [id],
        // Its kept old addresses go with it (#862, #925).
        recipe: (draft) => {
          deletePageFrom(draft, id);
          tidyKeptAddresses(draft);
        },
      };
    },
  },
  /**
   * Renames a page, as the person's *Rename* does (4.11, AIB-3): its title, and its file name with
   * it unless that was set by hand. Once the site has been published, or when `keepOldAddress`
   * says so, the old address keeps working, listed in Site Settings, as the rename dialog's
   * *Keep the old address working* does (#862, #925); either way, the list loses an address the
   * page has again. All in the one undo step.
   */
  renamePage: {
    description:
      "Renames a page: its title, and its file name with it unless the person set that by hand. updatePageSettings changes the title alone. Once the site has been published, the page's old address keeps working (visitors and search engines are sent on to the new one); keepOldAddress true or false chooses. One undo step.",
    input: z.strictObject({
      pageId,
      title: z.string().min(1).max(200),
      keepOldAddress: z.boolean().optional(),
    }),
    summarize(summary: PlanSummary, site: SiteDoc, input: { pageId: string; title: string }) {
      summarizeRename(summary, site, input.pageId, input.title);
    },
    plan(
      site: SiteDoc,
      input: { pageId: string; title: string; keepOldAddress?: boolean | undefined },
      context: PlanContext = UNPUBLISHED,
    ): Plan | Failure {
      const page = pageOf(site, input.pageId);
      if (failed(page)) return page;
      const title = pageTitle(input.title);
      if (title === "") return fail("invalid", "A page needs a title.");
      if (title === page.title) return fail("invalid", `The page is already called "${title}".`);
      const { id } = page;
      return {
        action: t("pages.history.renamed", { name: title }),
        structural: true,
        kind: "props",
        recipe: (draft) => {
          if (input.keepOldAddress ?? context.published) {
            keepingOldAddresses(draft, () => renamePageIn(draft, id, title));
          } else {
            renamePageIn(draft, id, title);
            tidyKeptAddresses(draft);
          }
        },
      };
    },
  },
  /**
   * Moves a page up or down among its folder's pages, as the Pages panel's arrows do (4.11, AIB-3):
   * the navigation's order too, while the menu follows the pages.
   */
  movePage: {
    description:
      "Moves a page up or down among the pages in its folder, steps places (1 if left out): the navigation's order too, while the menu follows the pages. One undo step.",
    input: z.strictObject({
      pageId,
      direction: z.enum(["up", "down"]),
      steps: z.int().min(1).max(200).default(1),
    }),
    summarize(summary: PlanSummary, site: SiteDoc, input: { pageId: string }) {
      summary.pagesMoved.add(pageTitleOf(site, input.pageId));
    },
    plan(
      site: SiteDoc,
      input: { pageId: string; direction: "up" | "down"; steps: number },
    ): Plan | Failure {
      const page = pageOf(site, input.pageId);
      if (failed(page)) return page;
      const direction = input.direction === "up" ? -1 : 1;
      // Each swap is with the page next to it then, as the arrows' are.
      const order = { ...site, pageOrder: [...site.pageOrder] };
      for (let step = 0; step < input.steps; step++) {
        const other = pageNeighbour(order, page.id, direction);
        if (other === undefined) {
          return fail(
            "invalid",
            step === 0
              ? `The page is already the ${direction === -1 ? "first" : "last"} in its folder.`
              : `The page can move ${step} place${step === 1 ? "" : "s"} ${input.direction}, not ${input.steps}.`,
          );
        }
        const [from, to] = [order.pageOrder.indexOf(page.id), order.pageOrder.indexOf(other)];
        order.pageOrder[from] = other;
        order.pageOrder[to] = page.id;
      }
      const { id, title } = page;
      return {
        action: t("history.moved", { item: pageItem(title) }),
        structural: true,
        kind: "move",
        recipe: (draft) => {
          for (let step = 0; step < input.steps; step++) {
            const other = pageNeighbour(draft, id, direction);
            if (other === undefined) return;
            swapPages(draft, id, other);
          }
        },
      };
    },
  },
  /**
   * Changes a page's settings, as Page Settings does (4.11, AIB-3): its title (its file name
   * stays), search description, *Hide from navigation* and *Hide this page from search engines*.
   * Content mode takes the title and description only (§5.10).
   */
  updatePageSettings: {
    description:
      'Changes a page\'s settings: its title (shown in the browser tab and search results; the file name stays), its search description ("" for the site\'s), hideFromNavigation and hideFromSearch. "Page not found" is always hidden from both. One undo step.',
    input: z
      .strictObject({
        pageId,
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(PAGE_DESCRIPTION_MAX).optional(),
        hideFromNavigation: z.boolean().optional(),
        hideFromSearch: z.boolean().optional(),
      })
      .refine(
        (input) =>
          input.title !== undefined ||
          input.description !== undefined ||
          input.hideFromNavigation !== undefined ||
          input.hideFromSearch !== undefined,
        "Give at least one setting to change.",
      ),
    summarize(
      summary: PlanSummary,
      site: SiteDoc,
      input: { pageId: string; title?: string | undefined },
    ) {
      const { pageId, title, ...others } = input;
      summarizeRename(summary, site, pageId, title);
      // Its other settings, besides the title, are named as Page Settings changed.
      if (Object.keys(others).length > 0) summary.pagesSet.add(pageTitleOf(site, pageId));
    },
    plan(
      site: SiteDoc,
      input: {
        pageId: string;
        title?: string | undefined;
        description?: string | undefined;
        hideFromNavigation?: boolean | undefined;
        hideFromSearch?: boolean | undefined;
      },
    ): Plan | Failure {
      const page = pageOf(site, input.pageId);
      if (failed(page)) return page;
      const switches = input.hideFromNavigation !== undefined || input.hideFromSearch !== undefined;
      if (page.kind === "not-found" && switches) {
        return fail(
          "refused",
          'The "Page not found" page is always hidden from navigation and search engines.',
        );
      }
      const title = input.title === undefined ? page.title : pageTitle(input.title);
      if (title === "") return fail("invalid", "A page needs a title.");
      const description = input.description?.trim();
      const { settings } = page;
      if (
        title === page.title &&
        (description === undefined || description === (settings.description ?? "")) &&
        (input.hideFromNavigation === undefined ||
          input.hideFromNavigation === settings.hideFromNavigation) &&
        (input.hideFromSearch === undefined ||
          input.hideFromSearch === (settings.hideFromSearch === true))
      ) {
        return fail("invalid", "The page's settings are already like that.");
      }
      const { id } = page;
      return {
        action: t("history.changedPage"),
        // Content mode: the title and description are content; the two switches aren't (§5.10).
        structural: switches,
        kind: "props",
        recipe: (draft) => {
          const target = draft.pages[id];
          if (target === undefined) return;
          target.title = title;
          if (description !== undefined) {
            if (description === "") delete target.settings.description;
            else target.settings.description = description;
          }
          if (input.hideFromNavigation !== undefined) {
            target.settings.hideFromNavigation = input.hideFromNavigation;
          }
          // Absent when shown, as in files from before it.
          if (input.hideFromSearch === true) target.settings.hideFromSearch = true;
          if (input.hideFromSearch === false) delete target.settings.hideFromSearch;
        },
      };
    },
  },
} as const;
