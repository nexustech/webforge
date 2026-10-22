import { type MediaId, mediaIdSchema, type PageId, pageIdSchema } from "./ids.js";
import { anchorIdSchema, type LinkValue, linkValueSchema } from "./link.js";

/**
 * Links in rich text (F-ED-3, F-ED-18) are `<a href>` in its HTML. A link to one of the site's
 * pages is stored by the page's id, `webforge:page/<id>` (with `#<anchor>` for a section), so
 * renaming or moving the page never breaks it; the export turns it into a relative path, as it
 * does for link fields.
 */
export const RICH_TEXT_PAGE_LINK = "webforge:page/";

/**
 * A link to a document in Media (1.28) is stored by its Media id, `webforge:file/<id>`, with
 * `?download` when it is saved rather than opened; the export turns it into the document's path
 * in `files/`.
 */
export const RICH_TEXT_FILE_LINK = "webforge:file/";

const DOWNLOAD = "?download";

/** A link in rich text as the editor holds it: its address, and whether it opens a new tab. */
export type RichTextLink = { readonly href: string; readonly newTab: boolean };

/** The `href` rich text stores for `link`. */
export function richTextHref(link: LinkValue): string {
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
      return `${RICH_TEXT_FILE_LINK}${link.mediaId}${link.download === true ? DOWNLOAD : ""}`;
  }
}

/** A link to a document from a `webforge:file/…` address, if it is one. */
function fileLinkOf(href: string): { mediaId: MediaId; download?: true } | undefined {
  if (!href.startsWith(RICH_TEXT_FILE_LINK)) return undefined;
  const rest = href.slice(RICH_TEXT_FILE_LINK.length);
  const download = rest.endsWith(DOWNLOAD);
  const mediaId = mediaIdSchema.safeParse(download ? rest.slice(0, -DOWNLOAD.length) : rest);
  if (!mediaId.success) return undefined;
  return download ? { mediaId: mediaId.data, download: true } : { mediaId: mediaId.data };
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
  const file = fileLinkOf(href);
  let value: unknown;
  if (page !== undefined) {
    value = { kind: "page", ...page, ...tab };
  } else if (file !== undefined) {
    value = { kind: "file", ...file, ...tab };
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

/** `webforge:file/…` in an `href` attribute, as the editor writes it. */
const FILE_HREF = /href="webforge:file\/([^"]*)"/g;

/** The `webforge:` links of either kind, for rewriting them in one pass. */
const SITE_HREF = /href="(webforge:(?:page|file)\/[^"]*)"/g;

/** The links to the site's pages in rich-text `html`, for the broken-link check. */
export function richTextPageLinks(html: string): { pageId: PageId; anchor?: string }[] {
  return [...html.matchAll(PAGE_HREF)].flatMap(([, rest = ""]) => {
    const link = pageLinkOf(`${RICH_TEXT_PAGE_LINK}${rest}`);
    return link === undefined ? [] : [link];
  });
}

/** The links to documents in rich-text `html` (1.28), for the export and its checks. */
export function richTextFileLinks(html: string): { mediaId: MediaId; download?: true }[] {
  return [...html.matchAll(FILE_HREF)].flatMap(([, rest = ""]) => {
    const link = fileLinkOf(`${RICH_TEXT_FILE_LINK}${rest}`);
    return link === undefined ? [] : [link];
  });
}

/**
 * `html` with its links to the site's pages and documents pointing where `hrefOf` says (the
 * export's relative paths), a document to save with `download`. A link that isn't valid any more
 * goes to `#`.
 */
export function rewriteRichTextLinks(
  html: string,
  hrefOf: (link: Extract<LinkValue, { kind: "page" | "file" }>) => string,
): string {
  return html.replace(SITE_HREF, (_match, address: string) => {
    const page = pageLinkOf(address);
    const file = fileLinkOf(address);
    const href =
      page !== undefined
        ? hrefOf({ kind: "page", ...page })
        : file !== undefined
          ? hrefOf({ kind: "file", ...file })
          : "#";
    const escaped = href.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
    return file?.download === true ? `href="${escaped}" download=""` : `href="${escaped}"`;
  });
}
