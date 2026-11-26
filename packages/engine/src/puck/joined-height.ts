/** The variable the joined Header's place and its first section's room for it read (HH-1). */
const HEIGHT = "--wf-header-h";

/**
 * Gives the canvas's page the height of a Header joined to its first section (HH-1), or with its
 * own band over a first section that fills the window (HH-4, `data-wf-height`), as the exported
 * site's `joined.js` does: where the Header sits over the section, and the room the section makes
 * for it, read `--wf-header-h`. Without it they'd keep the CSS's estimate for the
 * Header's layout, which a large logo or a long name outgrows. It follows the Header as Puck draws
 * it again (another page shown, a layout chosen) and as it changes size. Returns what stops it.
 */
export function followJoinedHeight(doc: Document): () => void {
  const view = doc.defaultView;
  if (view === null) return () => {};
  const root = doc.documentElement;
  let shown: HTMLElement | null = null;
  const measure = () => {
    if (shown === null) root.style.removeProperty(HEIGHT);
    else root.style.setProperty(HEIGHT, `${shown.offsetHeight}px`);
  };
  const resized = new view.ResizeObserver(measure);
  const find = () => {
    const found = doc.querySelector("[data-wf-joined], [data-wf-height]");
    const next = found instanceof view.HTMLElement ? found : null;
    if (next === shown) return;
    if (shown !== null) resized.unobserve(shown);
    shown = next;
    if (shown !== null) resized.observe(shown);
    measure();
  };
  // One look per change Puck commits: whether the joined Header came, went or was drawn anew.
  const changed = new view.MutationObserver(find);
  changed.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-wf-joined", "data-wf-height"],
  });
  find();
  return () => {
    changed.disconnect();
    resized.disconnect();
    root.style.removeProperty(HEIGHT);
  };
}
