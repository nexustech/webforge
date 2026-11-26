import { type ElectronApplication, expect, type Locator, type Page } from "@playwright/test";
import { stillBox } from "./canvas-click.js";

// Whether a dialog or panel fits the window (product owner, 26 Nov 2026; CLAUDE.md, "Every dialog
// and panel fits the window"): inside it and below the title bar, never scrolling sideways, and at
// most one scroll area under the pointer anywhere in it. Written for the styling dialogs (#1440, H3)
// for #1433's spec, which checks every dialog and panel, to take over.

/**
 * Sizes the editor's window to `width` × `height` px, at `zoom` times the interface's text
 * (Settings' text size, 125% as 1.25), and waits until the page is as wide as that makes it: the
 * window unmaximized, and allowed smaller than the least it keeps for the size of its text (#1195).
 * Returns the page's width and height in CSS px.
 */
export async function sizeWindow(
  app: ElectronApplication,
  page: Page,
  { width, height, zoom = 1 }: { width: number; height: number; zoom?: number },
): Promise<{ width: number; height: number }> {
  await page.evaluate(
    (interfaceZoom) =>
      (
        window as unknown as { webforge: { prefs: { set(change: unknown): Promise<unknown> } } }
      ).webforge.prefs.set({ interfaceZoom }),
    zoom,
  );
  const css = Math.floor(width / zoom);
  await expect(async () => {
    await app.evaluate(
      ({ BrowserWindow }, size) => {
        const main = BrowserWindow.getAllWindows()[0];
        main?.unmaximize();
        main?.setMinimumSize(600, 400);
        main?.setContentSize(size.width, size.height);
      },
      { width, height },
    );
    const inner = await page.evaluate(() => window.innerWidth);
    expect(Math.abs(inner - css)).toBeLessThanOrEqual(1);
  }).toPass();
  return page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
}

/**
 * Checks `target` (a dialog or a panel), once it is still, sits inside the window and below the
 * title bar (or the window controls' area, where that is lower), and that neither it nor anything
 * in it scrolls sideways.
 */
export async function expectFitsWindow(target: Locator, name: string): Promise<void> {
  await stillBox(target);
  const fit = await target.evaluate((element) => {
    const overlay = (
      navigator as Navigator & {
        windowControlsOverlay?: { visible: boolean; getTitlebarAreaRect(): DOMRect };
      }
    ).windowControlsOverlay;
    const controls = overlay?.visible === true ? overlay.getTitlebarAreaRect().bottom : 0;
    const bar =
      document.querySelector('[data-slot="title-bar"]')?.getBoundingClientRect().bottom ?? 0;
    const box = element.getBoundingClientRect();
    // What scrolls sideways: wider than it shows, where it may scroll that way.
    const sideways = [element, ...element.querySelectorAll("*")]
      .filter((each) => {
        const { overflowX } = getComputedStyle(each);
        return (
          (overflowX === "auto" || overflowX === "scroll") &&
          each.scrollWidth > each.clientWidth + 1
        );
      })
      .map((each) => each.getAttribute("aria-label") ?? each.className.toString().slice(0, 60));
    return {
      top: box.top,
      left: box.left,
      right: box.right,
      bottom: box.bottom,
      titleBar: Math.max(bar, controls),
      width: window.innerWidth,
      height: window.innerHeight,
      sideways,
    };
  });
  expect(fit.top, `${name}: below the title bar`).toBeGreaterThanOrEqual(fit.titleBar);
  expect(fit.left, `${name}: inside the window's left edge`).toBeGreaterThanOrEqual(0);
  expect(fit.right, `${name}: inside the window's right edge`).toBeLessThanOrEqual(fit.width);
  expect(fit.bottom, `${name}: inside the window's bottom edge`).toBeLessThanOrEqual(fit.height);
  expect(fit.sideways, `${name}: nothing in it scrolls sideways`).toEqual([]);
}

/**
 * The scroll areas under the pointer at the middle of `target`, scrolled into view first, from the
 * innermost out: each element between it and the page that can scroll (its overflow lets it, and
 * what it holds is longer than it shows), named by its label or classes.
 */
async function scrollAreasUnder(target: Locator): Promise<string[]> {
  await target.scrollIntoViewIfNeeded();
  return target.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    const areas: string[] = [];
    for (let each = hit; each !== null; each = each.parentElement) {
      const style = getComputedStyle(each);
      const scrolls = (overflow: string) => overflow === "auto" || overflow === "scroll";
      if (
        (scrolls(style.overflowY) && each.scrollHeight > each.clientHeight + 1) ||
        (scrolls(style.overflowX) && each.scrollWidth > each.clientWidth + 1)
      ) {
        areas.push(each.getAttribute("aria-label") ?? each.className.toString().slice(0, 60));
      }
    }
    return areas;
  });
}

/** Checks there is at most one scroll area under the pointer at each of `targets`. */
export async function expectOneScrollAreaUnder(
  targets: readonly Locator[],
  name: string,
): Promise<void> {
  for (const [index, target] of targets.entries()) {
    const areas = await scrollAreasUnder(target);
    expect(
      areas.length,
      `${name}, ${index + 1} of ${targets.length}: ${areas.join(" in ")}`,
    ).toBeLessThanOrEqual(1);
  }
}
