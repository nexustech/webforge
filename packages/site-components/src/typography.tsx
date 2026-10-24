import type { ReactNode } from "react";
import { linkAttributes } from "./library.js";
import type { RenderContext } from "./schema.js";

/**
 * The one source of the catalogue's title, body-text and button classes (2.19), where 2.3's type
 * scale lands. A test checks the catalogue's HTML uses no others, so a component draws its titles
 * with {@link SectionTitle}, its text with {@link BodyText} and its buttons with
 * {@link ButtonLink} or {@link BUTTON_CLASSES}, and never writes them out.
 */

/** Title sizes: a page's (a Hero's, a large Heading), a section's, and a small one. */
export const TITLE_CLASSES = {
  page: "text-4xl font-bold md:text-5xl",
  section: "text-3xl font-bold",
  small: "text-xl font-semibold",
} as const;

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
  return <Tag className={TITLE_CLASSES[size]}>{children}</Tag>;
}

/** Running text: paragraphs, links underlined, space between paragraphs. */
export const BODY_TEXT_CLASSES = "text-lg leading-relaxed [&_a]:underline [&_p+p]:mt-4";

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
 * for the Header's menu). Placing classes come after these ("btn btn-primary btn-lg mt-8").
 */
export const BUTTON_CLASSES = {
  primary: "btn btn-primary",
  primarySmall: "btn btn-primary btn-sm",
  primaryLarge: "btn btn-primary btn-lg",
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
  readonly kind?: "primary" | "primarySmall" | "primaryLarge";
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
