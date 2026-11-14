/**
 * Escaping text for HTML and for regular expressions (#988): one copy of each, for the model, the
 * pipeline, the templates and the app.
 */

/** `text` escaped for HTML between tags: `&`, `<` and `>`, as rich text holds it. */
export const escapeHtmlText = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** `text` escaped for HTML between tags and in a double-quoted attribute: `"` too. */
export const escapeHtml = (text: string): string => escapeHtmlText(text).replaceAll('"', "&quot;");

/** `text` as a regular expression that matches it literally. */
export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
