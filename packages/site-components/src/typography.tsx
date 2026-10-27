import { createContext, type ReactNode, useContext } from "react";
import { linkAttributes } from "./library.js";
import type { RenderContext } from "./schema.js";

/**
 * The one source of the catalogue's title, body-text and button classes (2.19), where 2.3's type
 * scale lands. A test checks the catalogue's HTML uses no others, so a component draws its titles
 * with {@link SectionTitle}, its text with {@link BodyText} and its buttons with
 * {@link ButtonLink} or {@link BUTTON_CLASSES}, and never writes them out.
 */

/**
 * Title sizes: a page's (a Hero's, a large Heading), a section's, and a small one, in the theme's
 * heading font at its type scale's h1, h2 and h3 (size, weight and line height, #419). The theme
 * sets the page title a size smaller on phones.
 */
export const TITLE_CLASSES = {
  page: "font-heading text-h1",
  section: "font-heading text-h2",
  small: "font-heading text-h3",
} as const;

/**
 * The Text classes of the section a title is in (2.22, ST-1): a section's Appearance styles its
 * title, the page's or the section's, never a small one. `defineSection` provides them, and every
 * element resets them for what it holds, so they reach no title but the section's own.
 */
export const SectionTitleAppearance = createContext("");

/** The heading level of each title size: a page has one h1. */
const TITLE_TAG = { page: "h1", section: "h2", small: "h3" } as const;

/** A title of `size` (a section's unless said), at its heading level. */
export function SectionTitle({
  children,
  size = "section",
}: {
  readonly children: ReactNode;
  readonly size?: keyof typeof TITLE_CLASSES;
}) {
  const Tag = TITLE_TAG[size];
  const appearance = useContext(SectionTitleAppearance);
  const own = size === "small" || appearance === "" ? "" : ` ${appearance}`;
  return <Tag className={`${TITLE_CLASSES[size]}${own}`}>{children}</Tag>;
}

/**
 * Bullets or numbers, an indent and space around them, for the lists rich text holds (#388):
 * Tailwind's base styles take them away. They style lists inside the element they're on, never
 * that element itself, so the List element, whose own <ul> carries the body-text classes, keeps
 * its own markers.
 */
export const RICH_TEXT_LIST_CLASSES =
  "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6";

/**
 * Links in running text, underlined as the theme says (#423): always, or only on hover and
 * keyboard focus, in the main colour then, so they stand apart from the text (WCAG 1.4.1); always
 * where no theme says (Storybook's own themes). Never a button drawn as a link, which has its own.
 */
const LINK_CLASSES =
  "[&_a:not(.btn)]:[text-decoration-line:var(--wf-link-decoration,underline)] [&_a:not(.btn):hover]:[text-decoration-line:var(--wf-link-hover-decoration,underline)] [&_a:not(.btn):focus-visible]:[text-decoration-line:var(--wf-link-hover-decoration,underline)] [&_a:not(.btn)]:[color:var(--wf-link-color,currentColor)]";

/**
 * Running text at the type scale's body size (#419): paragraphs, links underlined as the theme
 * says, space between paragraphs, its lists marked.
 */
export const BODY_TEXT_CLASSES = `text-body ${LINK_CLASSES} [&_p+p]:mt-4 ${RICH_TEXT_LIST_CLASSES}`;

/**
 * A lead: the line under a page's or a section's title (a Hero's, a Call to action's, a
 * carousel's), at the type scale's body size, so a theme's body text reaches the top of a page.
 * Placing classes come before it ("py-6 text-body").
 */
export const LEAD_TEXT_CLASSES = "text-body";

/** Running text, in a `<div>` that holds its paragraphs; `className` places it ("mt-4"). */
export function BodyText({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={className === undefined ? BODY_TEXT_CLASSES : `${className} ${BODY_TEXT_CLASSES}`}
    >
      {children}
    </div>
  );
}

/**
 * The catalogue's buttons: the main colour's at three sizes, and icon buttons (round, or square
 * for the Header's menu). Placing classes come after these ("btn btn-primary btn-lg mt-8"). The
 * main ones take the theme's button style (#423); `filled` is the main colour filled whatever the
 * theme says, for a Button set to Filled (`wf-filled` keeps the theme's style off it, PH2-14).
 */
export const BUTTON_CLASSES = {
  primary: "btn btn-primary",
  primarySmall: "btn btn-primary btn-sm",
  primaryLarge: "btn btn-primary btn-lg",
  filled: "btn btn-primary wf-filled",
  filledSmall: "btn btn-primary btn-sm wf-filled",
  filledLarge: "btn btn-primary btn-lg wf-filled",
  secondary: "btn btn-secondary",
  secondarySmall: "btn btn-secondary btn-sm",
  secondaryLarge: "btn btn-secondary btn-lg",
  outline: "btn btn-outline btn-primary",
  outlineSmall: "btn btn-outline btn-primary btn-sm",
  outlineLarge: "btn btn-outline btn-primary btn-lg",
  icon: "btn btn-circle btn-ghost",
  iconSmall: "btn btn-circle btn-sm btn-ghost",
  menu: "btn btn-square btn-ghost",
} as const;

/** A link drawn as a button of `kind`, if it has a label; `className` places it ("mt-8"). */
export function ButtonLink({
  label,
  link,
  context,
  kind = "primary",
  className,
}: {
  readonly label: string;
  /** A link field's value, resolved with the render context. */
  readonly link: unknown;
  readonly context: RenderContext;
  readonly kind?: "primary" | "primarySmall" | "primaryLarge" | "outline" | "outlineSmall";
  readonly className?: string;
}) {
  if (label === "") return null;
  return (
    <a
      className={
        className === undefined ? BUTTON_CLASSES[kind] : `${BUTTON_CLASSES[kind]} ${className}`
      }
      {...linkAttributes(link, context)}
    >
      {label}
    </a>
  );
}
