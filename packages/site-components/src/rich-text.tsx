import { sanitizeRichText } from "./rich-text-html.js";

/**
 * Rich text in an exported page: sanitised HTML in a `display: contents` wrapper, so the
 * paragraphs lay out as if they were direct children of the component.
 */
export function RichText({ html }: { readonly html: string }) {
  return <div className="contents" dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }} />;
}
