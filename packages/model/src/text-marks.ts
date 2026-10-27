import { isNodeDoc, type NodeDoc } from "./documents.js";
import type { PageId, SharedSectionId } from "./ids.js";
import type { SiteDoc } from "./site-doc.js";

// Text marks in rich text (2.25, ST-3): underline, and a highlight or a text colour from the
// theme's roles, never a colour of its own, so a theme switch and dark sections keep them readable.
// Each is a class on a `span` (or a `u`), which the site CSS compiles from the theme like any other.

/** The theme roles a highlight or a text colour can take, as the editor names them. */
export const TEXT_MARK_ROLES = ["brand", "accent", "text", "surface"] as const;

/** One of {@link TEXT_MARK_ROLES}. */
export type TextMarkRole = (typeof TEXT_MARK_ROLES)[number];

/**
 * A highlight's class for each role: a soft wash of the role's colour behind the text, which keeps
 * the text's own colour readable on it.
 */
export const HIGHLIGHT_CLASSES: Readonly<Record<TextMarkRole, string>> = {
  brand: "bg-primary/20",
  accent: "bg-accent/30",
  text: "bg-base-content/10",
  surface: "bg-base-200",
};

/**
 * A text colour's class for each role it offers: not Surface, the page's own background, which
 * would hide the text in a section on it.
 */
export const TEXT_COLOR_CLASSES: Readonly<Partial<Record<TextMarkRole, string>>> = {
  brand: "text-primary",
  accent: "text-accent",
  text: "text-base-content",
};

/** Every class a text mark's `span` may carry: what the sanitiser keeps, and nothing else. */
export const TEXT_MARK_CLASSES: readonly string[] = [
  ...Object.values(HIGHLIGHT_CLASSES),
  ...Object.values(TEXT_COLOR_CLASSES).filter((name) => name !== undefined),
];

/** Where underlined text that isn't a link is: the page (or the Header, Footer or a shared section) and its element. */
export type UnderlinedText = {
  readonly on: PageId | "header" | "footer" | SharedSectionId;
  readonly nodeId: string;
};

/** Underlines in rich-text `html` that aren't links: any `<u>` with text, once links are taken out. */
export function hasUnderlinedNonLink(html: string): boolean {
  if (!html.includes("<u")) return false;
  const withoutLinks = html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, "");
  for (const [, inner = ""] of withoutLinks.matchAll(/<u\b[^>]*>([\s\S]*?)<\/u>/gi)) {
    if (inner.replace(/<[^>]*>/g, "").trim() !== "") return true;
  }
  return false;
}

/** Whether `value`, a field's value but not the elements inside it, has such an underline. */
function underlinedIn(value: unknown): boolean {
  if (typeof value === "string") return hasUnderlinedNonLink(value);
  if (Array.isArray(value)) return value.some((item) => !isNodeDoc(item) && underlinedIn(item));
  if (typeof value !== "object" || value === null || isNodeDoc(value)) return false;
  return Object.values(value).some(underlinedIn);
}

/** Every element in `nodes`, their slots included, with underlined text that isn't a link. */
function walk(nodes: readonly NodeDoc[], found: (nodeId: string) => void): void {
  for (const node of nodes) {
    if (Object.values(node.props).some((value) => !isNodeDoc(value) && underlinedIn(value))) {
      found(node.props.id);
    }
    for (const value of Object.values(node.props)) {
      if (Array.isArray(value)) walk(value.filter(isNodeDoc), found);
    }
  }
}

/**
 * Underlined text that isn't a link (2.25, ST-3), which a visitor can take for one. Site Check (3.6)
 * lists each as a tip; it never blocks publishing.
 */
export function findUnderlinedText(site: SiteDoc): UnderlinedText[] {
  const found: UnderlinedText[] = [];
  for (const id of site.pageOrder) {
    const page = site.pages[id];
    if (page !== undefined) walk(page.doc.content, (nodeId) => found.push({ on: id, nodeId }));
  }
  for (const part of ["header", "footer"] as const) {
    walk(site.layout[part], (nodeId) => found.push({ on: part, nodeId }));
  }
  for (const shared of Object.values(site.sharedSections)) {
    walk([shared.section], (nodeId) => found.push({ on: shared.id, nodeId }));
  }
  return found;
}
