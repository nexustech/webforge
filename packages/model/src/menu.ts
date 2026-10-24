import { z } from "zod";
import { type MediaId, menuItemIdSchema, pageIdSchema } from "./ids.js";
import { anchorIdSchema, linkValueSchema, pageLinkSchema } from "./link.js";

/** The longest label a menu item can have, in the menu or as a page's navigation label (S5). */
export const MENU_LABEL_MAX = 100;

const label = z.string().min(1).max(MENU_LABEL_MAX);

const itemBase = {
  id: menuItemIdSchema,
  /** Kept in the menu editor but left out of the site's navigation. */
  hidden: z.boolean(),
};

/** A page of the site; shows the page's navigation label unless `label` overrides it. */
const pageItemSchema = z.strictObject({
  ...itemBase,
  kind: z.literal("page"),
  pageId: pageIdSchema,
  label: label.optional(),
});

/** A link anywhere: another site, an e-mail address, a file. */
const linkItemSchema = z.strictObject({
  ...itemBase,
  kind: z.literal("link"),
  link: linkValueSchema,
  label,
});

/** A link to a section on one of the site's pages (G3): always a page link with an anchor. */
const sectionItemSchema = z.strictObject({
  ...itemBase,
  kind: z.literal("section"),
  link: pageLinkSchema.extend({ anchor: anchorIdSchema }),
  label,
});

/** A link shown as a button, e.g. "Book now". */
const buttonItemSchema = z.strictObject({
  ...itemBase,
  kind: z.literal("button"),
  link: linkValueSchema,
  label,
});

/** Any item that is not a group: what a dropdown can contain. */
const menuLeafSchema = z.discriminatedUnion("kind", [
  pageItemSchema,
  linkItemSchema,
  sectionItemSchema,
  buttonItemSchema,
]);

/** A dropdown sub-menu. One level deep, so the mobile menu stays usable. */
const groupItemSchema = z.strictObject({
  ...itemBase,
  kind: z.literal("group"),
  label,
  children: z.array(menuLeafSchema),
});

/** An item of the navigation menu. */
export const menuItemSchema = z.discriminatedUnion("kind", [
  pageItemSchema,
  linkItemSchema,
  sectionItemSchema,
  buttonItemSchema,
  groupItemSchema,
]);

/** See {@link menuItemSchema}. */
export type MenuItem = z.infer<typeof menuItemSchema>;
/** A menu item that can sit inside a dropdown. */
export type MenuLeaf = z.infer<typeof menuLeafSchema>;

/**
 * The site's navigation menu (F-ED-17, G2), rendered by the Header's navbar. It `follows` the page
 * order until the user edits the menu itself; from then on it is `custom`, and new pages are added
 * at the end (decision S6).
 */
export const menuDocSchema = z.strictObject({
  follows: z.enum(["pages", "custom"]),
  items: z.array(menuItemSchema),
});

/** See {@link menuDocSchema}. */
export type MenuDoc = z.infer<typeof menuDocSchema>;

/**
 * The Media files the navigation menu links to, from its items and dropdowns, hidden items
 * included: the export ships them, and Media counts them as used on every page.
 */
export function menuFileLinks(menu: MenuDoc): MediaId[] {
  return menu.items
    .flatMap((item) => (item.kind === "group" ? item.children : [item]))
    .flatMap((item) =>
      (item.kind === "link" || item.kind === "button") && item.link.kind === "file"
        ? [item.link.mediaId]
        : [],
    );
}
