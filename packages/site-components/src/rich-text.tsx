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
  allowedAttributes: { a: ["href"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
};

/** Removes everything from rich-text HTML except basic formatting and safe links. */
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
