import { expect, userEvent } from "storybook/test";

/** What a keyboard user can reach with Tab: links, form controls, a `<details>`' summary. */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

/** What can show the focus: an outline or ring, or a change of colour or underline. */
const FOCUS_STYLES = [
  "outline-style",
  "outline-width",
  "outline-color",
  "box-shadow",
  "background-color",
  "color",
  "border-color",
  "text-decoration-line",
] as const;

/**
 * How `control` looks, with its two nearest ancestors: daisyUI shows some controls' focus on what
 * holds them (an FAQ question's box), and some by a change of colour (a menu's links), not a ring.
 */
function looks(control: Element): string {
  const elements = [control, control.parentElement, control.parentElement?.parentElement];
  return JSON.stringify(
    elements.map((element) => {
      if (element === null || element === undefined) return null;
      const style = getComputedStyle(element);
      return FOCUS_STYLES.map((name) => style.getPropertyValue(name));
    }),
  );
}

/** No transitions while checking, so a control's look is read as it ends, not halfway. */
const STILL = "*, *::before, *::after { transition: none !important; animation: none !important; }";

/**
 * The keyboard check every site component's story ends with (2.16, standards §5), the way a
 * visitor without a mouse meets the export, before its script runs:
 * - Tab reaches every control on the page, in the page's order, and nothing hidden (a closed
 *   menu's links);
 * - each control shows that it has the focus;
 * - a `<details>` (an FAQ question, a dropdown, the phone menu) opens and closes from its summary,
 *   which browsers do with Enter and Space as with a click. Synthetic key presses can't do that,
 *   so the check makes sure the summary is its `<details>`' own, then clicks it.
 *
 * It leaves the story as it found it, so the screenshot that follows is the story's own.
 */
export async function checkKeyboard(root: HTMLElement): Promise<void> {
  const controls = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    // Not hidden: a closed menu's links, or the lightbox, which daisyUI hides by its visibility.
    (element) =>
      element.checkVisibility({ visibilityProperty: true }) && element.closest("[inert]") === null,
  );
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
  const still = document.createElement("style");
  still.textContent = STILL;
  document.head.append(still);
  try {
    for (const control of controls) {
      const before = looks(control);
      await userEvent.tab();
      await expect(document.activeElement, "Tab reaches the next control").toBe(control);
      await expect(looks(control), `${describe(control)} shows its focus`).not.toBe(before);
      if (control.tagName === "SUMMARY") {
        const details = control.parentElement;
        await expect(
          details instanceof HTMLDetailsElement && details.querySelector(":scope > summary"),
          `${describe(control)} is its <details>' own summary`,
        ).toBe(control);
        if (details instanceof HTMLDetailsElement) {
          const open = details.open;
          control.click();
          await expect(details.open, `${describe(control)} opens and closes`).toBe(!open);
          control.click();
          await expect(details.open).toBe(open);
        }
      }
    }
  } finally {
    still.remove();
    const focused = document.activeElement;
    if (focused instanceof HTMLElement) focused.blur();
    window.scrollTo(0, 0);
  }
}

/** `element` named for a failure message: its tag and text. */
function describe(element: HTMLElement): string {
  return `<${element.tagName.toLowerCase()}> "${(element.textContent ?? "").trim().slice(0, 40)}"`;
}
