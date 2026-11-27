import { type ElectronApplication, expect, type Locator, type Page } from "@playwright/test";
import { stillBox } from "./canvas-click.js";

// Whether a dialog or panel fits the window (product owner, 26 Nov 2026; CLAUDE.md, "Every dialog
// and panel fits the window"): inside it and below the title bar, never scrolling sideways, never
// scrolling itself as well as something inside it, its top still as its content changes, and at
// most one scroll area under the pointer anywhere in it. `dialog-fit.spec.ts` holds every dialog
// and panel to these (#1433); the styling dialogs' spec adds their own (#1440, H3).

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

/**
 * The rules a dialog or panel is held to (#1433), numbered as the issue numbers them:
 * - 2: inside the window, its top below the title bar (or the window controls' area);
 * - 3: nothing in it scrolls sideways;
 * - 4: when something inside it scrolls, it doesn't scroll itself as well;
 * - 5: its top stays put through a change of state ({@link movedFaults});
 * - 6: the title bar fits ({@link titleBarFaults}).
 */
export type FitRule = 2 | 3 | 4 | 5 | 6;

/** A rule broken, with what was measured, so a failure says what it saw (anti-pattern 20). */
export type FitFault = {
  readonly rule: FitRule;
  readonly says: string;
  /** The change of state it showed after, by name; none for what showed once it opened. */
  readonly change?: string;
};

/** What {@link fitOf} measures of a dialog or panel, in CSS px. */
export type Fit = {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  /** Where the title bar ends: the bar the page draws, or the window controls' area if lower. */
  readonly titleBar: number;
  /** Where the bar the page draws ends: 0 when none was found, which rule 2 reports. */
  readonly bar: number;
  readonly window: { readonly width: number; readonly height: number };
  /** What scrolls sideways in it, itself included: label or classes, and by how much. */
  readonly sideways: readonly string[];
  /** How far it scrolls itself, top to bottom: 0 when it doesn't. */
  readonly ownScroll: number;
  /** What inside it scrolls up and down, by label or classes. */
  readonly innerScrolls: readonly string[];
};

/** One reading of {@link Fit}, in the page. */
function readFit(target: Locator): Promise<Fit> {
  return target.evaluate((element) => {
    const overlay = (
      navigator as Navigator & {
        windowControlsOverlay?: { visible: boolean; getTitlebarAreaRect(): DOMRect };
      }
    ).windowControlsOverlay;
    const controls = overlay?.visible === true ? overlay.getTitlebarAreaRect().bottom : 0;
    const bar =
      document.querySelector('[data-slot="title-bar"]')?.getBoundingClientRect().bottom ?? 0;
    const box = element.getBoundingClientRect();
    const name = (each: Element) =>
      each.getAttribute("aria-label") ?? (each.className.toString().slice(0, 60) || each.tagName);
    const scrolls = (overflow: string) => overflow === "auto" || overflow === "scroll";
    const sideways: string[] = [];
    const innerScrolls: string[] = [];
    for (const each of [element, ...element.querySelectorAll("*")]) {
      const style = getComputedStyle(each);
      if (scrolls(style.overflowX) && each.scrollWidth > each.clientWidth + 1) {
        sideways.push(`${name(each)} (${each.scrollWidth} in ${each.clientWidth})`);
      }
      if (
        each !== element &&
        scrolls(style.overflowY) &&
        each.scrollHeight > each.clientHeight + 1
      ) {
        innerScrolls.push(name(each));
      }
    }
    const own = getComputedStyle(element);
    return {
      top: Math.round(box.top * 10) / 10,
      left: Math.round(box.left * 10) / 10,
      right: Math.round(box.right * 10) / 10,
      bottom: Math.round(box.bottom * 10) / 10,
      titleBar: Math.round(Math.max(bar, controls) * 10) / 10,
      bar: Math.round(bar * 10) / 10,
      window: { width: window.innerWidth, height: window.innerHeight },
      sideways,
      ownScroll: scrolls(own.overflowY)
        ? Math.max(0, element.scrollHeight - element.clientHeight)
        : 0,
      innerScrolls,
    };
  });
}

/**
 * `target`'s {@link Fit} once the page has settled (anti-pattern 19): its box still across two
 * animation frames, then the same reading twice, 100 ms apart. A list still filling in or a
 * window controls' overlay reporting late both show as a second reading that differs.
 */
export async function fitOf(target: Locator): Promise<Fit> {
  await stillBox(target);
  let last = "";
  let fit: Fit | undefined;
  await expect
    .poll(
      async () => {
        fit = await readFit(target);
        const now = JSON.stringify(fit);
        const same = now === last;
        last = now;
        return same;
      },
      { intervals: [100], message: "the dialog or panel keeps still" },
    )
    .toBe(true);
  if (fit === undefined) throw new Error("Not measured");
  return fit;
}

/**
 * The faults `fit` shows against rules 2–4, those of `rules` that are checked. `overlap` is how far
 * it may reach over the title bar: a menu hangs from its title there.
 */
export function fitFaults(fit: Fit, rules: readonly FitRule[], overlap = 0): FitFault[] {
  const faults: FitFault[] = [];
  const { top, left, right, bottom, titleBar, window } = fit;
  // No title bar found, as when its data-slot is renamed: nothing to measure the top against, which
  // would pass every dialog where the window controls take no room (Linux, macOS).
  if (rules.includes(2) && fit.bar === 0) {
    faults.push({ rule: 2, says: 'no title bar measured: no [data-slot="title-bar"] drawn' });
  }
  // Half a pixel for the interface zoom's rounding (#1195).
  if (
    rules.includes(2) &&
    (top < titleBar - overlap - 0.5 ||
      left < -0.5 ||
      right > window.width + 0.5 ||
      bottom > window.height + 0.5)
  ) {
    faults.push({
      rule: 2,
      says: `box ${left},${top} to ${right},${bottom} in a ${window.width} × ${window.height} window, the title bar ending at ${titleBar}`,
    });
  }
  if (rules.includes(3) && fit.sideways.length > 0) {
    faults.push({ rule: 3, says: `scrolls sideways: ${fit.sideways.join(", ")}` });
  }
  if (rules.includes(4) && fit.ownScroll > 1 && fit.innerScrolls.length > 0) {
    faults.push({
      rule: 4,
      says: `scrolls ${fit.ownScroll} px itself while ${fit.innerScrolls.join(", ")} scrolls inside it`,
    });
  }
  return faults;
}

/** The fault, if any, of a top edge that moved from `before` to `after` as `change` happened. */
export function movedFaults(before: Fit, after: Fit, change: string): FitFault[] {
  return Math.abs(after.top - before.top) > 1
    ? [{ rule: 5, says: `${change}: its top moved from ${before.top} to ${after.top}` }]
    : [];
}

/**
 * The title bar's layout with Site Check showing `count`: whether any two of its controls are over
 * each other or anything is cut off, where Publish ends against the window's own buttons (Windows,
 * Linux), and how wide the search box is, which takes what's left (#1166).
 */
export function titleBarLayout(page: Page, count: string) {
  return page.getByRole("banner").evaluate((header, shown) => {
    const check = [...header.querySelectorAll("button")].find((button) =>
      (button.getAttribute("aria-label") ?? "").startsWith("Site Check:"),
    );
    const text = [...(check?.querySelectorAll("span") ?? [])].find(
      (span) => getComputedStyle(span).display !== "none",
    );
    if (text !== undefined) text.textContent = shown;
    const overlay = (
      navigator as Navigator & {
        windowControlsOverlay?: { visible: boolean; getTitlebarAreaRect(): DOMRect };
      }
    ).windowControlsOverlay;
    const room =
      overlay?.visible === true
        ? overlay.getTitlebarAreaRect().right
        : document.documentElement.clientWidth;
    // Each control: a button, a menu's title or a choice, not one holding another.
    const controls = [
      ...header.querySelectorAll<HTMLElement>("button, [role='menuitem'], [role='radio']"),
    ]
      .filter((each) => each.getBoundingClientRect().width > 0)
      .filter((each) => each.querySelector("button, [role='menuitem'], [role='radio']") === null);
    const overlaps: string[] = [];
    controls.forEach((a, index) => {
      for (const b of controls.slice(index + 1)) {
        const [ra, rb] = [a.getBoundingClientRect(), b.getBoundingClientRect()];
        if (ra.left < rb.right - 0.5 && rb.left < ra.right - 0.5) {
          overlaps.push(
            `${a.getAttribute("aria-label") ?? a.textContent} × ${b.getAttribute("aria-label") ?? b.textContent}`,
          );
        }
      }
    });
    const publish = controls.find((each) => each.textContent === "Publish");
    const searchBox = header.querySelector("button[aria-haspopup='dialog']");
    // The control that reaches furthest right, against the window controls' area.
    const furthest = controls.reduce<HTMLElement | undefined>(
      (far, each) =>
        far === undefined || each.getBoundingClientRect().right > far.getBoundingClientRect().right
          ? each
          : far,
      undefined,
    );
    return {
      searchWidth: searchBox?.getBoundingClientRect().width ?? 0,
      room,
      publishRight: publish?.getBoundingClientRect().right ?? Number.POSITIVE_INFINITY,
      furthestRight: furthest?.getBoundingClientRect().right ?? 0,
      furthest: furthest?.getAttribute("aria-label") ?? furthest?.textContent ?? "",
      overlaps,
      scrollWidth: header.scrollWidth,
      clientWidth: header.clientWidth,
    };
  }, count);
}

/** The title bar's layout, as {@link titleBarLayout} reads it. */
export type TitleBarLayout = Awaited<ReturnType<typeof titleBarLayout>>;

/**
 * The faults of rule 6 in `layout`: controls over each other, the bar scrolling sideways, or a
 * control reaching into the window controls' area. Half a pixel for the zoom's rounding (#1195).
 */
export function titleBarFaults(layout: TitleBarLayout): FitFault[] {
  const faults: FitFault[] = [];
  if (layout.overlaps.length > 0) {
    faults.push({ rule: 6, says: `controls over each other: ${layout.overlaps.join(", ")}` });
  }
  if (layout.scrollWidth > layout.clientWidth) {
    faults.push({
      rule: 6,
      says: `the bar scrolls sideways: ${layout.scrollWidth} in ${layout.clientWidth}`,
    });
  }
  if (layout.furthestRight > layout.room + 0.5) {
    faults.push({
      rule: 6,
      says: `${layout.furthest} ends at ${layout.furthestRight}, past the window controls at ${layout.room}`,
    });
  }
  return faults;
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
