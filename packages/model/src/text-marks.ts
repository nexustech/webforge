import { isNodeDoc } from "./documents.js";
import type { SiteDoc } from "./site-doc.js";
import { type ElementPlace, eachElement } from "./site-elements.js";

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
  readonly on: ElementPlace;
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

/**
 * Underlined text that isn't a link (2.25, ST-3), which a visitor can take for one. Site Check (3.6)
 * lists each as a tip; it never blocks publishing. `skipHidden` leaves out hidden elements.
 */
export function findUnderlinedText(
  site: SiteDoc,
  options: { readonly skipHidden?: boolean } = {},
): UnderlinedText[] {
  const found: UnderlinedText[] = [];
  eachElement(
    site,
    (node, on) => {
      if (Object.values(node.props).some(underlinedIn)) found.push({ on, nodeId: node.props.id });
    },
    options,
  );
  return found;
}
