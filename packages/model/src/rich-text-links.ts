import { type PageId, pageIdSchema } from "./ids.js";
import { anchorIdSchema, type LinkValue, linkValueSchema } from "./link.js";

/**
 * Links in rich text (F-ED-3, F-ED-18) are `<a href>` in its HTML. A link to one of the site's
 * pages is stored by the page's id, `webforge:page/<id>` (with `#<anchor>` for a section), so
 * renaming or moving the page never breaks it; the export turns it into a relative path, as it
 * does for link fields.
 */
export const RICH_TEXT_PAGE_LINK = "webforge:page/";

/** A link in rich text as the editor holds it: its address, and whether it opens a new tab. */
export type RichTextLink = { readonly href: string; readonly newTab: boolean };

/** The `href` rich text stores for `link`, or undefined for a link it can't hold (a file). */
export function richTextHref(link: LinkValue): string | undefined {
  switch (link.kind) {
    case "page":
      return `${RICH_TEXT_PAGE_LINK}${link.pageId}${link.anchor === undefined ? "" : `#${link.anchor}`}`;
    case "email":
      return link.subject === undefined || link.subject === ""
        ? `mailto:${link.address}`
        : `mailto:${link.address}?subject=${encodeURIComponent(link.subject)}`;
    case "phone":
      return `tel:${link.number}`;
    case "url":
      return link.href;
    case "file":
      return undefined;
  }
}

/** A link to a page (and section) from a `webforge:page/…` address, if it is one. */
function pageLinkOf(href: string): { pageId: PageId; anchor?: string } | undefined {
  if (!href.startsWith(RICH_TEXT_PAGE_LINK)) return undefined;
  const [id = "", anchor] = href.slice(RICH_TEXT_PAGE_LINK.length).split("#", 2);
  const pageId = pageIdSchema.safeParse(id);
  if (!pageId.success) return undefined;
  if (anchor === undefined) return { pageId: pageId.data };
  return anchorIdSchema.safeParse(anchor).success ? { pageId: pageId.data, anchor } : undefined;
}

/** The `subject` of a `mailto:` address's query, as {@link richTextHref} writes it. */
function subjectOf(query: string): string | undefined {
  const value = query
    .split("&")
    .find((part) => part.startsWith("subject="))
    ?.slice("subject=".length);
  try {
    return value === undefined ? undefined : decodeURIComponent(value.replaceAll("+", " "));
  } catch {
    return undefined;
  }
}

/** The link value a rich-text link stands for, to edit it in the link dialog, if it is valid. */
export function richTextLinkValue({ href, newTab }: RichTextLink): LinkValue | undefined {
  const tab = newTab ? { newTab: true } : {};
  const page = pageLinkOf(href);
  let value: unknown;
  if (page !== undefined) {
    value = { kind: "page", ...page, ...tab };
  } else if (href.startsWith("mailto:")) {
    const [address = "", query = ""] = href.slice("mailto:".length).split("?", 2);
    const subject = subjectOf(query);
    value = { kind: "email", address, ...(subject ? { subject } : {}), ...tab };
  } else if (href.startsWith("tel:")) {
    value = { kind: "phone", number: href.slice("tel:".length), ...tab };
  } else {
    value = { kind: "url", href, ...tab };
  }
  const parsed = linkValueSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/** `webforge:page/…` in an `href` attribute, as the editor writes it. */
const PAGE_HREF = /href="webforge:page\/([^"]*)"/g;

/** The links to the site's pages in rich-text `html`, for the broken-link check. */
export function richTextPageLinks(html: string): { pageId: PageId; anchor?: string }[] {
  return [...html.matchAll(PAGE_HREF)].flatMap(([, rest = ""]) => {
    const link = pageLinkOf(`${RICH_TEXT_PAGE_LINK}${rest}`);
    return link === undefined ? [] : [link];
  });
}

/**
 * `html` with its links to the site's pages pointing where `hrefOf` says (the export's relative
 * paths). A link to a page that isn't there any more goes to `#`.
 */
export function rewriteRichTextLinks(
  html: string,
  hrefOf: (link: Extract<LinkValue, { kind: "page" }>) => string,
): string {
  return html.replace(PAGE_HREF, (_match, rest: string) => {
    const link = pageLinkOf(`${RICH_TEXT_PAGE_LINK}${rest}`);
    const href = link === undefined ? "#" : hrefOf({ kind: "page", ...link });
    return `href="${href.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"`;
  });
}
