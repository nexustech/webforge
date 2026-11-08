import type { HelpTarget } from "../../shared/ipc/help.js";

/** Where a link on a help page goes. */
export type HelpLinkDestination =
  /** Another help page, or a heading of one, shown in the Help window. */
  | { readonly kind: "help"; readonly target: HelpTarget }
  /** A page on the web, opened in the browser. */
  | { readonly kind: "web"; readonly url: string }
  /** Nowhere the Help window can go: shown as text. */
  | { readonly kind: "none" };

/**
 * Where `href`, a link on help page `page`, goes (5.4b, HP-6): `export.md#options` and `#tips`
 * stay in the Help window, an `https://` page opens in the browser, and anything else (a plain
 * `http://` page, a file, a `mailto:`, a page outside `docs/help/`) is shown as text (5.6). `pnpm help-check` keeps
 * the pages from linking anywhere else.
 */
export function helpLinkDestination(href: string, page: string | undefined): HelpLinkDestination {
  if (/^https:\/\//i.test(href)) return { kind: "web", url: href };
  const link = /^(?:([a-z0-9-]+)\.md)?(?:#([\p{L}\p{N}_-]+))?$/u.exec(href);
  if (link === null || href === "") return { kind: "none" };
  const [, file, anchor] = link;
  const target = file ?? page;
  if (target === undefined) return { kind: "none" };
  return {
    kind: "help",
    target: anchor === undefined ? { page: target } : { page: target, anchor },
  };
}
