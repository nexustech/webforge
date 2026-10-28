import {
  newId,
  type PageId,
  RICH_TEXT_PAGE_LINK,
  type SiteDoc,
  syncMenuWithPages,
} from "@webforge/model";
import { z } from "zod";
import { insertRecipePage, PAGE_RECIPES } from "./recipes.js";

/**
 * The quick start's Pages step (QS-1, QS-3, 3.11): the template's pages the person unticked, and
 * the page recipes they ticked, by id. The home page and "Page not found" can't be left out.
 */
export const pageChoicesSchema = z.strictObject({
  leaveOut: z.array(z.string().max(100)).max(50),
  recipes: z.array(z.string().max(100)).max(50),
});

/** See {@link pageChoicesSchema}. */
export type PageChoices = z.infer<typeof pageChoicesSchema>;

/**
 * Applies the Pages step to `site`, a new site: leaves out the pages it names, its links to them
 * going to the home page instead, and adds a page for each recipe, in the order ticked, before
 * "Page not found". Ids it doesn't know, of pages or recipes, are passed over.
 */
export function choosePages(site: SiteDoc, choices: PageChoices): void {
  const removed = new Set(
    choices.leaveOut.filter((id): id is PageId => {
      const page = site.pages[id as PageId];
      return page !== undefined && page.kind === "page" && page.id !== site.homePageId;
    }),
  );
  for (const id of removed) {
    delete site.pages[id];
    site.pageOrder.splice(site.pageOrder.indexOf(id), 1);
  }
  if (removed.size > 0) {
    site.menu = syncMenuWithPages(site);
    retargetLinks(site, removed);
  }
  for (const recipeId of choices.recipes) {
    const recipe = PAGE_RECIPES.find((each) => each.id === recipeId);
    if (recipe !== undefined) insertRecipePage(site, newId("page"), recipe);
  }
}

/** Points every link to a page in `removed` at the home page: in props, menus and rich text. */
function retargetLinks(site: SiteDoc, removed: ReadonlySet<PageId>): void {
  const home = site.homePageId;
  const inRichText = new RegExp(
    `${RICH_TEXT_PAGE_LINK}(${[...removed].map((id) => id.replace(/[^\w-]/g, "")).join("|")})(?:#[^"]*)?"`,
    "g",
  );
  const visit = (value: unknown): unknown => {
    if (typeof value === "string")
      return value.replace(inRichText, `${RICH_TEXT_PAGE_LINK}${home}"`);
    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) value[index] = visit(item);
      return value;
    }
    if (typeof value === "object" && value !== null) {
      const record = value as Record<string, unknown>;
      if (record.kind === "page" && removed.has(record.pageId as PageId)) {
        record.pageId = home;
        delete record.anchor;
      }
      for (const [key, item] of Object.entries(record)) record[key] = visit(item);
    }
    return value;
  };
  for (const page of Object.values(site.pages)) visit(page.doc);
  visit(site.layout);
  visit(site.sharedSections);
  visit(site.menu);
}
