/**
 * Keeps the canvas iframe's document `target` on the page being edited: a click on a link in it,
 * or Enter on a focused one (which the browser turns into a click), follows nothing. Most links on
 * the canvas go to `#`, but a Gallery image links to its file (2.7a), which would replace the
 * canvas with the image. Only the browser's default is cancelled: Puck still selects the element.
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
