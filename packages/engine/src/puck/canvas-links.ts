/**
 * Keeps the canvas iframe's document `target` on the page being edited: a click on a link in it,
 * or Enter on a focused one (which the browser turns into a click), follows nothing. Links on the
 * canvas go to `#`, which in the iframe's `about:srcdoc` page replaces the canvas with an error
 * page, or to a web address. Puck's overlay takes mouse clicks, but not Enter. Only the browser's
 * default is cancelled: Puck still selects the element (#337).
 */
export function keepLinksOnCanvas(target: Document): () => void {
  const onClick = (event: MouseEvent) => {
    // The canvas's elements are the iframe's, so `instanceof` against the editor's realm fails.
    const clicked = event.target as Partial<Element> | null;
    if ((clicked?.closest?.("a[href]") ?? null) !== null) {
      event.preventDefault();
    }
  };
  target.addEventListener("click", onClick, { capture: true });
  return () => target.removeEventListener("click", onClick, { capture: true });
}
