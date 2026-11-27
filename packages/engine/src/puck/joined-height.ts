/** The variable the joined Header's place and its first section's room for it read (HH-1). */
const HEIGHT = "--wf-header-h";
/** Where the first section filling the window starts, which its height reads (#1489). */
const ABOVE = "--wf-above-h";

/**
 * Gives the canvas's page the height of a Header joined to its first section (HH-1), or with its
 * own band over a first section that fills the window (HH-4, `data-wf-height`), as the exported
 * site's `joined.js` does: where the Header sits over the section, and the room the section makes
 * for it, read `--wf-header-h`. Without it they'd keep the CSS's estimate for the
 * Header's layout, which a large logo or a long name outgrows. It follows the Header as Puck draws
 * it again (another page shown, a layout chosen) and as it changes size. Where that section
 * (`data-wf-fills`) starts, below the Header and any Announcement bar, goes in `--wf-above-h`, which
 * its height leaves out (#1489). Returns what stops it.
 */
export function followJoinedHeight(doc: Document): () => void {
  const view = doc.defaultView;
  if (view === null) return () => {};
  const root = doc.documentElement;
  let shown: HTMLElement | null = null;
  let bars: readonly Element[] = [];
  const above = () => {
    const fills = doc.querySelector("[data-wf-fills]");
    if (fills === null) root.style.removeProperty(ABOVE);
    else {
      // Where it starts on the page: against the page's own box, both from the same layout.
      const top = fills.getBoundingClientRect().top - root.getBoundingClientRect().top;
      root.style.setProperty(ABOVE, `${Math.max(0, top)}px`);
    }
  };
  const measure = () => {
    if (shown === null) root.style.removeProperty(HEIGHT);
    else root.style.setProperty(HEIGHT, `${shown.offsetHeight}px`);
    above();
  };
  const resized = new view.ResizeObserver(measure);
  // Each one's whole box: a change of padding alone doesn't change its content's.
  const BOX: ResizeObserverOptions = { box: "border-box" };
  const find = () => {
    // The Announcement bars above the Header: one closed, edited or wrapping moves the section.
    const nextBars = [...doc.querySelectorAll("[data-wf-announcement]")];
    for (const bar of bars) if (!nextBars.includes(bar)) resized.unobserve(bar);
    for (const bar of nextBars) if (!bars.includes(bar)) resized.observe(bar, BOX);
    bars = nextBars;
    const found = doc.querySelector("[data-wf-joined], [data-wf-height]");
    const next = found instanceof view.HTMLElement ? found : null;
    if (next !== shown) {
      if (shown !== null) resized.unobserve(shown);
      shown = next;
      if (shown !== null) resized.observe(shown, BOX);
      measure();
    } else {
      // The Header as it was: only the section's start may have moved (a section added above it).
      above();
    }
  };
  // One look per change Puck commits: whether the joined Header came, went or was drawn anew, and
  // whether a section filling the window, or a bar, did.
  const changed = new view.MutationObserver(find);
  changed.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-wf-joined", "data-wf-height", "data-wf-fills"],
  });
  find();
  return () => {
    changed.disconnect();
    resized.disconnect();
    root.style.removeProperty(HEIGHT);
    root.style.removeProperty(ABOVE);
  };
}
