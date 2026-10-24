/**
 * Keeps the canvas iframe's document `target` on the page being edited:
 * - A click on a link in it, or Enter on a focused one (which the browser turns into a click),
 *   follows nothing. Links on the canvas go to `#`, which in the iframe's `about:srcdoc` page
 *   replaces the canvas with an error page, or to a web address. Puck's overlay takes mouse
 *   clicks, but not Enter (#337).
 * - A form in it submits nowhere: Enter in one of its fields, or its button, would load its action
 *   in the iframe (a contact form, a newsletter sign-up).
 *
 * Only the browser's default is cancelled: Puck still selects the element.
 */
export function keepCanvasOnPage(target: Document): () => void {
  const onClick = (event: MouseEvent) => {
    // The canvas's elements are the iframe's, so `instanceof` against the editor's realm fails.
    const clicked = event.target as Partial<Element> | null;
    if ((clicked?.closest?.("a[href]") ?? null) !== null) {
      event.preventDefault();
    }
  };
  const onSubmit = (event: Event) => {
    event.preventDefault();
  };
  target.addEventListener("click", onClick, { capture: true });
  target.addEventListener("submit", onSubmit, { capture: true });
  return () => {
    target.removeEventListener("click", onClick, { capture: true });
    target.removeEventListener("submit", onSubmit, { capture: true });
  };
}
