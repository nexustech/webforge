import { t } from "@webforge/i18n";
import { escapeHtml, insertPage, type NodeDoc, type PageId, type SiteDoc } from "@webforge/model";

// What the pages Add Page writes for the owner to start from share (#855, #866): the Privacy,
// Terms and Cookies pages are written from Site Settings as rich text, and open with the same
// note that they aren't legal advice.

/** `text` as rich text's paragraph: a business name or an email address can hold `&` or `<`. */
const paragraph = (text: string) => `<p>${escapeHtml(text)}</p>`;

/** A Text section titled `title` with `paragraphs`, in the page's colours. */
export const textSection = (id: string, title: string, paragraphs: readonly string[]): NodeDoc => ({
  type: "TextSection",
  props: { id, colors: "page", title, text: paragraphs.map(paragraph).join("") },
});

/**
 * The page's main heading, `title`: a text-only Hero, without a button, holding the note to the
 * owner that the page is a start to check, not legal advice, which Site Check finds while it's
 * left in.
 */
export const openingSection = (id: string, title: string): NodeDoc => ({
  type: "Hero",
  props: {
    id,
    variant: "minimal",
    colors: "page",
    title,
    text: t("legalPage.note"),
    buttonLabel: "",
  },
});

/** Who runs `site`: the business name from Site Settings › Contact & hours, or the site's name. */
export const businessOf = (site: SiteDoc): string =>
  (site.settings.contact.businessName ?? "").trim() || site.settings.general.name;

/** The pages *Add Page* writes for the owner to start from: privacy, terms, cookie policy. */
export type PolicyPageKind = "privacy" | "terms" | "cookies";

/** What a page Add Page writes is: its name, its description for search, and its sections. */
export type PolicyPageContent = {
  readonly title: string;
  readonly description: string;
  readonly content: NodeDoc[];
};

/**
 * Adds `page` to `draft` (an undo step's) as page `id`, before a "Page not found" page that is
 * last, and in the menu if the menu follows the pages.
 */
export function insertPolicyPage(draft: SiteDoc, id: PageId, page: PolicyPageContent): void {
  insertPage(draft, id, page.title);
  const added = draft.pages[id];
  if (added === undefined) return;
  added.settings.description = page.description;
  added.doc.content = page.content;
}
