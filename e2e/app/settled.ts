import type { Locator } from "@playwright/test";
import { ACTION_BAR } from "@webforge/engine/puck-dom";

// The selected element's bar on the canvas takes its place after it shows: it moves off the
// element's text (#1177), and widens when text editing adds its format menu. A person's eye settles
// on a button before they click it; a test waits for the same (#1462).

/** How long apart the two looks at a button are. */
const LOOK_MS = 100;

/** How long a button may take to settle before the wait fails. */
const SETTLE_MS = 5_000;

/**
 * Waits until `button` is the same element in the same place across two looks {@link LOOK_MS}
 * apart. Logs what changed meanwhile, its place (by how much, how long after the first look) or
 * the element itself, so CI's logs say whether the bar moves or is drawn anew as it settles.
 */
export async function settled(button: Locator, name: string): Promise<void> {
  const look = () =>
    button.evaluate((element) => {
      const marked = element as Element & { wfSettle?: true };
      const seen = marked.wfSettle === true;
      marked.wfSettle = true;
      const { x, y } = element.getBoundingClientRect();
      return { seen, x: Math.round(x), y: Math.round(y) };
    });
  const start = Date.now();
  let last = await look();
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, LOOK_MS));
    const next = await look();
    const moved = next.x !== last.x || next.y !== last.y;
    if (next.seen && !moved) return;
    const after = Date.now() - start;
    console.log(
      next.seen
        ? `[settle] ${name} moved ${next.x - last.x}, ${next.y - last.y} px, ${after} ms after it showed`
        : `[settle] ${name} was drawn anew, ${after} ms after it showed`,
    );
    if (after > SETTLE_MS) throw new Error(`${name} didn't settle in ${SETTLE_MS} ms`);
    last = next;
  }
}

/**
 * Where `button` is as it's about to be clicked, for a failure to say: the bar's box, the button's,
 * and what's at the button's centre, which a click there lands on.
 */
function placeOf(button: Locator): Promise<string> {
  return button.evaluate((element, bar) => {
    const box = (rect: DOMRect | undefined) =>
      rect === undefined
        ? "none"
        : `${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)}×${Math.round(rect.height)}`;
    const own = element.getBoundingClientRect();
    const hit = element.ownerDocument.elementFromPoint(
      own.x + own.width / 2,
      own.y + own.height / 2,
    );
    const named = (found: Element | null) =>
      found === null
        ? "nothing"
        : `${found.tagName.toLowerCase()}${found.getAttribute("aria-label") === null ? "" : ` "${found.getAttribute("aria-label")}"`}${found === element || element.contains(found) ? " (the button)" : ""}`;
    return `bar at ${box(element.closest(bar)?.getBoundingClientRect())}, button at ${box(own)}, at its centre ${named(hit)}`;
  }, ACTION_BAR);
}

/**
 * Clicks `button`, a button of the selected element's bar, once it has settled ({@link settled}).
 * Returns where it was as it was clicked, for the assertion that follows to say if it fails.
 */
export async function clickSettled(button: Locator, name: string): Promise<string> {
  await settled(button, name);
  const where = await placeOf(button);
  await button.click();
  return `${name} clicked with its ${where}`;
}
