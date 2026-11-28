import { expect, type Locator, type Page } from "@playwright/test";

/** What {@link tabUntil} checks after each key. */
export type TabUntilOptions = {
  /** Shift+Tab, back through the order, rather than Tab. */
  readonly back?: boolean;
  /** The focus stays inside it all the way: a dialog, whose focus trap keeps it there. */
  readonly within?: Locator;
  /**
   * Where the focus must never be, said in words when it is (`null` when it isn't): inside a
   * preview, say (#1507).
   */
  readonly never?: () => Promise<string | null>;
  /** How many keys at most before it fails: a target never reached is a trap or a lost focus. */
  readonly max?: number;
};

/** The element with the focus, in a few words: its tag and name. */
const focusedName = (page: Page) =>
  page.evaluate(() => {
    const focused = document.activeElement;
    const label = focused?.getAttribute("aria-label") ?? focused?.textContent ?? "";
    const role = focused?.getAttribute("role");
    return `${focused?.tagName.toLowerCase()}${role ? `[${role}]` : ""} "${label.trim().slice(0, 30)}"`;
  });

/** Whether the focus is on `target` or inside it. */
const holdsFocus = (target: Locator) =>
  target.evaluate(
    (element) => element === document.activeElement || element.contains(document.activeElement),
  );

/**
 * Presses Tab (or Shift+Tab) until the focus is on `target` or inside it, checking after each key
 * that it's still `within` and never where `never` says (#1507, #1650). However many stops lie
 * between, which may change with what scrolls, it fails only if `target` is never reached within
 * `max` keys, saying which stops it passed (#1672). Gives the number of keys it took.
 */
export async function tabUntil(
  page: Page,
  target: Locator,
  { back = false, within, never, max = 40 }: TabUntilOptions = {},
): Promise<number> {
  const key = back ? "Shift+Tab" : "Tab";
  const passed: string[] = [];
  for (let pressed = 1; pressed <= max; pressed++) {
    await page.keyboard.press(key);
    passed.push(await focusedName(page));
    if (never !== undefined) expect(await never(), `${key} ${pressed}`).toBeNull();
    if (within !== undefined) {
      expect(await holdsFocus(within), `${key} ${pressed}: the focus stays inside`).toBe(true);
    }
    if (await holdsFocus(target)) return pressed;
  }
  throw new Error(`${key} didn't reach its target in ${max} keys, passing ${passed.join(", ")}`);
}
