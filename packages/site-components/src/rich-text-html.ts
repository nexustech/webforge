import { TEXT_MARK_CLASSES } from "@webforge/model";
import sanitizeHtml from "sanitize-html";
import { isDocumentPath } from "./document-path.js";

/** The addresses a link in an exported page may have. */
const SCHEMES = ["http", "https", "mailto", "tel"];

// Rich text is HTML from the editor (Tiptap). Anything outside this list is dropped before it
// reaches an exported page, so a crafted .wforge file cannot inject scripts or styles.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "a",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    // A highlight or text colour from the theme (2.25, ST-3), by its class only.
    "span",
  ],
  allowedAttributes: { a: ["href", "target", "rel", "download"], p: ["style"] },
  // The text marks' classes, and no others: a span pasted with classes of its own keeps its text.
  allowedClasses: { span: [...TEXT_MARK_CLASSES] },
  // `download` has no value: kept as a boolean attribute, not dropped as an empty one.
  nonBooleanAttributes: sanitizeHtml.defaults.nonBooleanAttributes.filter(
    (name) => name !== "download",
  ),
  // A paragraph's alignment (F-ED-3), which the editor writes as a style; no other styles.
  allowedStyles: { p: { "text-align": [/^(left|center|right|justify)$/] } },
  allowedSchemes: SCHEMES,
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  // A link opens a new tab only as the link dialog makes it (F-ED-18): `target="_blank"` with
  // `rel="noopener"`; any other target or rel is dropped. Only a link to an exported document
  // (`files/…`) may say `download`; on any other, it would save the page itself.
  transformTags: {
    a: (tagName, attribs) => {
      const { target: _target, rel: _rel, download: _download, ...rest } = attribs;
      return {
        tagName,
        attribs: {
          ...rest,
          ...(attribs.target === "_blank" ? { target: "_blank", rel: "noopener" } : {}),
          // A document saved rather than opened (1.28); never a file name of the page's choosing.
          ...(attribs.download !== undefined && isDocumentPath(attribs.href ?? "")
            ? { download: "" }
            : {}),
        },
      };
    },
  },
};

/** Removes everything from rich-text HTML except basic formatting, alignment and safe links. */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/**
 * Rich text as the site file holds it, from outside the editor (an AI app's, 4.8): the same, but
 * its links to the site's pages and documents stay as the editor stores them (`webforge:page/…`,
 * `webforge:file/…`), which the export rewrites before it sanitises.
 */
const STORED_OPTIONS: sanitizeHtml.IOptions = {
  ...SANITIZE_OPTIONS,
  allowedSchemes: [...SCHEMES, "webforge"],
};

/** Rich-text HTML cleaned as {@link sanitizeRichText} does, keeping links to the site's pages and documents. */
export function sanitizeStoredRichText(html: string): string {
  return sanitizeHtml(html, STORED_OPTIONS);
}
