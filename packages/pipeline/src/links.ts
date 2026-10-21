import type { LinkValue } from "@webforge/model";

/**
 * Where a link field's value goes on an exported page (F-ED-18), or undefined if nowhere:
 * - a page by its id, as a relative URL from the page being built (`prefix` is its `../` per
 *   folder), with `#anchor` for a section. Pages are found by id, so renaming or moving one
 *   never breaks a link;
 * - `mailto:` (with the subject, encoded), `tel:` (digits and a leading `+` only), a web address;
 * - files aren't exported yet, so a file link goes nowhere.
 */
export function hrefFor(
  link: LinkValue,
  pathOfPage: (pageId: string) => string | undefined,
  prefix: string,
): string | undefined {
  switch (link.kind) {
    case "page": {
      const path = pathOfPage(link.pageId);
      if (path === undefined) return undefined;
      return `${prefix}${path}.html${link.anchor === undefined ? "" : `#${link.anchor}`}`;
    }
    case "email":
      return link.subject === undefined || link.subject === ""
        ? `mailto:${link.address}`
        : `mailto:${link.address}?subject=${encodeURIComponent(link.subject)}`;
    case "phone":
      return `tel:${link.number.replace(/[^0-9+]/g, "")}`;
    case "url":
      return link.href;
    case "file":
      return undefined;
  }
}
