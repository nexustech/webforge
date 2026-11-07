import { t } from "@webforge/i18n";
import { COMMAND_IDS } from "./command-ids.js";
import type { CommandRegistry } from "./commands.js";
/**
 * The parts of the window F6 and Shift+F6 move between (5.5): the title bar, the left panels (or
 * their strip of icons), the page on the canvas, the bottom panel and the right panels (or their
 * strip), in that order, as Office and VS Code do. Each part is an element marked with
 * {@link REGION_ATTRIBUTE}; a hidden one is skipped.
 */
export const REGION_ATTRIBUTE = "data-region";

/** What takes the focus in a part, in the order Tab would reach it. */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** Where the focus was last in each part, to go back to it. */
const lastFocused = new WeakMap<Element, HTMLElement>();

/**
 * Whether `element` is shown: in the page, in no `hidden` part, and, where the browser can tell,
 * drawn (a control Puck hides with CSS isn't).
 */
const isShown = (element: Element) =>
  element.isConnected &&
  element.closest("[hidden]") === null &&
  (typeof element.checkVisibility !== "function" || element.checkVisibility());

/** The parts of `document`'s window that are shown, in order. */
function regionsOf(document: Document): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`[${REGION_ATTRIBUTE}]`)].filter(isShown);
}

/** Remembers, in each part, the last element that had the focus. Returns a function that stops. */
export function trackRegionFocus(document: Document): () => void {
  const remember = (event: FocusEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const region = target.closest<HTMLElement>(`[${REGION_ATTRIBUTE}]`);
    if (region !== null && region !== target) lastFocused.set(region, target);
  };
  document.addEventListener("focusin", remember);
  return () => document.removeEventListener("focusin", remember);
}

/** Focuses `element`; whether it took the focus. */
function tookFocus(element: HTMLElement): boolean {
  element.focus();
  return element.ownerDocument.activeElement === element;
}

/**
 * Puts the focus in `region`: where it was last, else the first of its controls that takes it,
 * else the part itself.
 */
function focusIn(region: HTMLElement): void {
  const last = lastFocused.get(region);
  if (last !== undefined && region.contains(last) && isShown(last) && tookFocus(last)) return;
  for (const control of region.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (isShown(control) && tookFocus(control)) return;
  }
  if (!region.hasAttribute("tabindex")) region.tabIndex = -1;
  region.focus();
}

/**
 * Moves the focus to the next part of the window (`step` 1) or the previous one (-1), from the
 * part that has it now; from none, to the first or the last. False if there is no part to go to.
 */
export function focusRegion(document: Document, step: 1 | -1): boolean {
  const regions = regionsOf(document);
  if (regions.length === 0) return false;
  const active = document.activeElement;
  const current = active === null ? -1 : regions.findIndex((region) => region.contains(active));
  const next =
    current === -1
      ? step === 1
        ? 0
        : regions.length - 1
      : (current + step + regions.length) % regions.length;
  const region = regions[next];
  if (region === undefined) return false;
  focusIn(region);
  return true;
}

/**
 * View › Next and Previous Part of the Window (F6, Shift+F6, 5.5), and the focus remembered in
 * each part to go back to. Returns a function that removes them.
 */
export function registerRegionCommands(registry: CommandRegistry, document: Document): () => void {
  const removers = [
    trackRegionFocus(document),
    registry.register({
      id: COMMAND_IDS.nextRegion,
      label: t("command.nextRegion"),
      menu: "view",
      run: () => {
        focusRegion(document, 1);
      },
    }),
    registry.register({
      id: COMMAND_IDS.previousRegion,
      label: t("command.previousRegion"),
      menu: "view",
      run: () => {
        focusRegion(document, -1);
      },
    }),
  ];
  return () => {
    for (const remove of removers.toReversed()) remove();
  };
}
