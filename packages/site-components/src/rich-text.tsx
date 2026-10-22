import sanitizeHtml from "sanitize-html";

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
  ],
  allowedAttributes: { a: ["href", "target", "rel", "download"], p: ["style"] },
  // `download` has no value: kept as a boolean attribute, not dropped as an empty one.
  nonBooleanAttributes: sanitizeHtml.defaults.nonBooleanAttributes.filter(
    (name) => name !== "download",
  ),
  // A paragraph's alignment (F-ED-3), which the editor writes as a style; no other styles.
  allowedStyles: { p: { "text-align": [/^(left|center|right|justify)$/] } },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  // A link opens a new tab only as the link dialog makes it (F-ED-18): `target="_blank"` with
  // `rel="noopener"`; any other target or rel is dropped. A document link may say `download`.
  transformTags: {
    a: (tagName, attribs) => {
      const { target: _target, rel: _rel, download: _download, ...rest } = attribs;
      return {
        tagName,
        attribs: {
          ...rest,
          ...(attribs.target === "_blank" ? { target: "_blank", rel: "noopener" } : {}),
          // A document saved rather than opened (1.28); never a file name of the page's choosing.
          ...(attribs.download === undefined ? {} : { download: "" }),
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
 * Rich text in an exported page: sanitised HTML in a `display: contents` wrapper, so the
 * paragraphs lay out as if they were direct children of the component.
 */
export function RichText({ html }: { readonly html: string }) {
  return <div className="contents" dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }} />;
}
