import { isPageIn, newId, type PageId, type SiteDoc, syncMenuWithPages } from "@webforge/model";
import { z } from "zod";
import { mergeIntoHome } from "./one-page.js";
import { insertRecipePage, PAGE_RECIPES } from "./recipes.js";
import { retargetLinks } from "./retarget-links.js";

/**
 * The quick start's Pages step (QS-1, QS-3, 3.11): the template's pages the person unticked, and
 * the page recipes they ticked, by id. The home page and "Page not found" can't be left out.
 * `onePage` makes the pages sections of the home page instead (GA10, 5.9).
 */
export const pageChoicesSchema = z.strictObject({
  leaveOut: z.array(z.string().max(100)).max(50),
  recipes: z.array(z.string().max(100)).max(50),
  onePage: z.boolean().optional(),
});

/** See {@link pageChoicesSchema}. */
export type PageChoices = z.infer<typeof pageChoicesSchema>;

/**
 * Applies the Pages step to `site`, a new site: leaves out the pages it names, its links to them
 * going to the home page instead, and adds a page for each recipe, in the order ticked, before
 * "Page not found". Ids it doesn't know, of pages or recipes, are passed over. With `onePage`, the
 * pages chosen then become sections of the home page ({@link mergeIntoHome}).
 */
export function choosePages(site: SiteDoc, choices: PageChoices): void {
  const removed = new Set(
    choices.leaveOut.filter((id): id is PageId => {
      if (!isPageIn(site.pages, id)) return false;
      const page = site.pages[id];
      return page !== undefined && page.kind === "page" && page.id !== site.homePageId;
    }),
  );
  for (const id of removed) {
    delete site.pages[id];
    site.pageOrder.splice(site.pageOrder.indexOf(id), 1);
  }
  if (removed.size > 0) {
    site.menu = syncMenuWithPages(site);
    retargetLinks(site, new Map([...removed].map((id) => [id, undefined])));
  }
  for (const recipeId of choices.recipes) {
    const recipe = PAGE_RECIPES.find((each) => each.id === recipeId);
    if (recipe !== undefined) insertRecipePage(site, newId("page"), recipe);
  }
  if (choices.onePage === true) mergeIntoHome(site);
}
