import { ensureStyle } from "./styles.js";

/** Marks the one `<style>` element that holds the site's CSS in the canvas document. */
const SITE_STYLE_ATTRIBUTE = "data-webforge-site-css";

/** Marks the `<style>` element that holds the site's own `custom.css` (F-ED-15, 6.8). */
const CUSTOM_STYLE_ATTRIBUTE = "data-webforge-custom-css";

/** Marks the `<style>` element that holds a theme being chosen, over the site's CSS (5.30). */
const THEME_PREVIEW_ATTRIBUTE = "data-webforge-theme-preview";

/**
 * Keeps the canvas's own styles in the export's order after the site's CSS: a theme being chosen
 * over it (5.30), then the site's `custom.css`, which the export links last.
 */
function keepOrder(document: Document): void {
  const [site, preview, custom] = [
    SITE_STYLE_ATTRIBUTE,
    THEME_PREVIEW_ATTRIBUTE,
    CUSTOM_STYLE_ATTRIBUTE,
  ].map((attribute) => document.head.querySelector(`style[${attribute}]`));
  let last = site ?? null;
  for (const style of [preview, custom]) {
    if (style === null || style === undefined) continue;
    if (last !== null && last.nextElementSibling !== style) last.after(style);
    last = style;
  }
}

/** The site's compiled CSS and the classes exported pages put on `<body>`. */
export type SiteStyles = { readonly css: string; readonly bodyClass: string };

/** Body classes added by {@link applySiteStyles}, per document, so the next call can replace them. */
const appliedBodyClasses = new WeakMap<Document, readonly string[]>();

/**
 * Whether this window's timeline has `webforge:canvas-styled`: when the canvas first showed the
 * site with its CSS, ready to edit, the last stage of a start-up's timing (#891).
 */
let canvasStyledMarked = false;

/**
 * Shows the site's own CSS in the canvas document (1.12): one `<style>` element, updated in place,
 * and the exported `<body>` classes. Puck's styles in the same document are left alone, and nothing
 * from the editor window is copied in (`syncHostStyles` stays off).
 */
export function applySiteStyles(document: Document, styles: SiteStyles): void {
  // First, so Puck's own canvas styles (added later) still win where they overlap.
  ensureStyle(document, SITE_STYLE_ATTRIBUTE, styles.css, "start");
  keepOrder(document);
  const classes = styles.bodyClass.split(/\s+/).filter((name) => name !== "");
  document.body.classList.remove(...(appliedBodyClasses.get(document) ?? []));
  document.body.classList.add(...classes);
  appliedBodyClasses.set(document, classes);
  if (!canvasStyledMarked) {
    canvasStyledMarked = true;
    performance.mark("webforge:canvas-styled");
  }
}

/**
 * Shows the site's own `custom.css` in the canvas document (6.8): one `<style>` element, updated in
 * place, right after the site's CSS, as the export links it after the site's stylesheet. Before the
 * site's CSS is there, it goes first in the head; {@link applySiteStyles} keeps the order.
 */
export function applyCustomCss(document: Document, css: string): void {
  ensureStyle(document, CUSTOM_STYLE_ATTRIBUTE, css, "start");
  keepOrder(document);
}

/**
 * Shows a theme being chosen in the canvas document (5.30, OL-18): its values (`themeValuesCss`) in
 * one `<style>` element right after the site's CSS, so they win over the site's compiled values
 * with no compile, and before `custom.css`, which still wins over both. An empty string shows the
 * site's CSS alone again.
 */
export function applyThemePreviewCss(document: Document, css: string): void {
  ensureStyle(document, THEME_PREVIEW_ATTRIBUTE, css, "start");
  keepOrder(document);
}
