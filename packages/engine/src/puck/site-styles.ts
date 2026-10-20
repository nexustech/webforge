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
  let element = document.head.querySelector<HTMLStyleElement>(`style[${SITE_STYLE_ATTRIBUTE}]`);
  if (element === null) {
    element = document.createElement("style");
    element.setAttribute(SITE_STYLE_ATTRIBUTE, "");
    // First, so Puck's own canvas styles (added later) still win where they overlap.
    document.head.prepend(element);
  }
  if (element.textContent !== styles.css) {
    element.textContent = styles.css;
  }
  const classes = styles.bodyClass.split(/\s+/).filter((name) => name !== "");
  document.body.classList.remove(...(appliedBodyClasses.get(document) ?? []));
  document.body.classList.add(...classes);
  appliedBodyClasses.set(document, classes);
}
