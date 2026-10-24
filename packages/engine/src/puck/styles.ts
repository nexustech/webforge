/**
 * The `<style>` element marked `attribute` in `document`'s head (R8): added once, at the end of the
 * head, or with `at: "start"` before everything else there (so later stylesheets win where they
 * overlap). Its text becomes `css` if given and different; without `css` it is left as it is.
 */
export function ensureStyle(
  document: Document,
  attribute: string,
  css?: string,
  at: "start" | "end" = "end",
): HTMLStyleElement {
  let style = document.head.querySelector<HTMLStyleElement>(`style[${attribute}]`);
  if (style === null) {
    style = document.createElement("style");
    style.setAttribute(attribute, "");
    if (at === "start") document.head.prepend(style);
    else document.head.append(style);
  }
  if (css !== undefined && style.textContent !== css) {
    style.textContent = css;
  }
  return style;
}
