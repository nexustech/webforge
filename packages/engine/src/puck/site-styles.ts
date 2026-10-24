import { ensureStyle } from "./styles.js";

/** Marks the one `<style>` element that holds the site's CSS in the canvas document. */
const SITE_STYLE_ATTRIBUTE = "data-webforge-site-css";

/** The site's compiled CSS and the classes exported pages put on `<body>`. */
export type SiteStyles = { readonly css: string; readonly bodyClass: string };

/** Body classes added by {@link applySiteStyles}, per document, so the next call can replace them. */
const appliedBodyClasses = new WeakMap<Document, readonly string[]>();

/**
 * Shows the site's own CSS in the canvas document (1.12): one `<style>` element, updated in place,
 * and the exported `<body>` classes. Puck's styles in the same document are left alone, and nothing
 * from the editor window is copied in (`syncHostStyles` stays off).
 */
export function applySiteStyles(document: Document, styles: SiteStyles): void {
  // First, so Puck's own canvas styles (added later) still win where they overlap.
  ensureStyle(document, SITE_STYLE_ATTRIBUTE, styles.css, "start");
  const classes = styles.bodyClass.split(/\s+/).filter((name) => name !== "");
  document.body.classList.remove(...(appliedBodyClasses.get(document) ?? []));
  document.body.classList.add(...classes);
  appliedBodyClasses.set(document, classes);
}
