import {
  type ElementPlace,
  eachElement,
  isSharedCopy,
  type NodeDoc,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import type { CatalogueField } from "@webforge/site-components/catalogue-data";
import type { CheckInput } from "./types.js";

/** A field's value on an element the export writes, and where it is. */
export type PlacedValue = {
  readonly on: ElementPlace;
  readonly node: NodeDoc;
  /** The field's name; `items.2.text` for a list item's field. */
  readonly field: string;
  readonly value: unknown;
};

/** The shared sections a page holds a copy of: the others aren't exported (F-ED-23). */
function placedSharedSections(site: SiteDoc): ReadonlySet<SharedSectionId> {
  return new Set(
    Object.values(site.pages).flatMap(({ doc }) =>
      doc.content.filter(isSharedCopy).map((copy) => copy.props.sharedSectionId),
    ),
  );
}

/**
 * Whether what is kept `on` is exported: the Header, the Footer and pages are; a shared section
 * only while a page holds a copy of it. Made once for a check of `site`.
 */
export function exportedPlaces(site: SiteDoc): (on: ElementPlace | "menu") => boolean {
  const placed = placedSharedSections(site);
  return (on) =>
    on === "menu" ||
    on === "header" ||
    on === "footer" ||
    Object.hasOwn(site.pages, on) ||
    placed.has(on as SharedSectionId);
}

/**
 * Calls `visit` with each value of a field of one of `kinds` on the site's elements, as the
 * catalogue describes them, list items' fields included. Hidden elements, and shared sections no
 * page holds, are left out: the export leaves them out too.
 */
export function eachFieldValue(
  { site, catalogue }: CheckInput,
  kinds: readonly CatalogueField["kind"][],
  visit: (placed: PlacedValue) => void,
): void {
  const wanted = new Set<string>(kinds);
  const exported = exportedPlaces(site);
  eachElement(
    site,
    (node, on) => {
      if (!exported(on)) return;
      const fields = catalogue[node.type]?.fields ?? {};
      for (const [name, field] of Object.entries(fields)) {
        const value = node.props[name];
        if (value === undefined) continue;
        if (wanted.has(field.kind)) visit({ on, node, field: name, value });
        if (field.kind !== "list" || !Array.isArray(value)) continue;
        value.forEach((item: unknown, index) => {
          if (typeof item !== "object" || item === null) return;
          for (const [itemName, itemField] of Object.entries(field.fields)) {
            const itemValue = (item as Record<string, unknown>)[itemName];
            if (itemValue !== undefined && wanted.has(itemField.kind)) {
              visit({ on, node, field: `${name}.${index}.${itemName}`, value: itemValue });
            }
          }
        });
      }
    },
    { skipHidden: true },
  );
}

/** A finding's key for a field of an element: unique in the site, as long as the element lasts. */
export const fieldKey = ({ on, node, field }: PlacedValue): string =>
  `${on}/${node.props.id}/${field}`;

/** Where a placed value is, for the panel to jump to its element. */
export const elementPlace = ({ on, node }: Pick<PlacedValue, "on" | "node">) =>
  ({ kind: "element", on, nodeId: node.props.id }) as const;

const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  nbsp: " ",
};

/** The text of rich text's `html`, as a visitor reads it: no tags, single spaces. */
export function plainText(html: string): string {
  return html
    .replace(/<\/(p|li|h[1-6])>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}
