import {
  insertPage,
  nodeDocSchema,
  PAGE_DESCRIPTION_MAX,
  PAGE_TITLE_MAX,
  type PageId,
  type SiteDoc,
} from "@webforge/model";
import { z } from "zod";
import { TEMPLATE_CATEGORIES, type TemplateCategory } from "./categories.js";
import data from "./recipes.json" with { type: "json" };

/**
 * A page a business type commonly adds beyond its template's (QS-3, 3.11): a few of the
 * catalogue's sections with placeholder copy in the glossary's voice. Its name in the editor is
 * `t("recipe.<id>")`; `title` is the page's own, as a template's pages are written. Its sections
 * take the site's theme like any other, and link nowhere, so they fit any template.
 */
export const pageRecipeSchema = z.strictObject({
  id: z.string().regex(/^[a-z]+(?:-[a-z]+)*$/),
  category: z.enum(TEMPLATE_CATEGORIES),
  title: z.string().min(1).max(PAGE_TITLE_MAX),
  description: z.string().max(PAGE_DESCRIPTION_MAX),
  content: z.array(nodeDocSchema).min(1),
});

/** See {@link pageRecipeSchema}. */
export type PageRecipe = z.infer<typeof pageRecipeSchema>;

/** Every page recipe, each id once, checked as it's read. */
export const PAGE_RECIPES: readonly PageRecipe[] = z
  .array(pageRecipeSchema)
  .refine((recipes) => new Set(recipes.map((recipe) => recipe.id)).size === recipes.length, {
    message: "A recipe id is listed twice",
  })
  .parse(data);

/** The page recipes of business type `category`, in the order the quick start lists them. */
export function recipesFor(category: TemplateCategory): readonly PageRecipe[] {
  return PAGE_RECIPES.filter((recipe) => recipe.category === category);
}

/**
 * Adds recipe `recipe` to `draft` (an undo step's, or a new site's) as page `id`: named and
 * described as the recipe says, its slug free, before a "Page not found" page that is last, and
 * in the menu if the menu follows the pages ({@link insertPage}).
 */
export function insertRecipePage(draft: SiteDoc, id: PageId, recipe: PageRecipe): void {
  insertPage(draft, id, recipe.title);
  const page = draft.pages[id];
  if (page === undefined) return;
  page.settings.description = recipe.description;
  page.doc.content = structuredClone(recipe.content);
}
