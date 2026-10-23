import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, totalmem } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
import { countNodes, largePage } from "@webforge/test-utils";
import { launchDesktopApp } from "../app/launch.js";

// Large-page performance check (spec/04 item 0.4, ADR 0007). Runs against a `--mode perf` build:
// `pnpm e2e:perf` from the repository root. Budgets: architecture §10 (keystroke and drag to canvas
// update < 16 ms) and U7 ("instant" undo, taken as < 100 ms). Misses are recorded, not hidden:
// expect.soft keeps measuring so the report is complete.

const SECTIONS = 25;
const QUESTIONS = 4;
const HISTORY_STEPS = 50;
const FRAME_BUDGET_MS = 16;
const INSTANT_MS = 100;

type PerfWindow = Window & {
  __webforgePerf?: { loadPage(page: unknown): void; addSteps(count: number): void };
};

let app: ElectronApplication;
let page: Page;
const results: Record<string, unknown> = {};

const canvasFrame = () => page.frameLocator(".editor__canvas iframe");
const p = (values: number[], q: number) =>
  [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(q * values.length))] ??
  0;
const summary = (values: number[]) => ({
  runs: values.length,
  p50: Math.round(p(values, 0.5)),
  p95: Math.round(p(values, 0.95)),
  max: Math.round(Math.max(...values)),
});

/**
 * Watches the window and the canvas iframe for long tasks (> 50 ms) and for slow keydowns
 * (Event Timing reports only events of 16 ms or more). For each keydown it records:
 * - `keydown`: the full duration up to the next painted frame (includes Chromium's own pipeline);
 * - `processing`: the time our handlers ran (processingEnd − processingStart), which is what the
 *   one-frame budget (§10) is about.
 */
async function startObservers(): Promise<void> {
  await page.evaluate(() => {
    // The canvas iframe has its own realm, so use each window's own PerformanceObserver.
    type Recorder = { __perf?: unknown; __perfObservers?: PerformanceObserver[] };
    const record = (target: Window, longTasks: boolean) => {
      // Called again after the large page loads: stop the previous observers first.
      const recorder = target as unknown as Recorder;
      for (const observer of recorder.__perfObservers ?? []) observer.disconnect();
      recorder.__perfObservers = [];
      const store = {
        longtask: [] as number[],
        keydown: [] as number[],
        processing: [] as number[],
      };
      recorder.__perf = store;
      const Observer = (target as unknown as typeof globalThis).PerformanceObserver;
      if (longTasks) {
        const observer = new Observer((list) => {
          for (const entry of list.getEntries()) store.longtask.push(entry.duration);
        });
        observer.observe({ type: "longtask" });
        recorder.__perfObservers.push(observer);
      }
      const events = new Observer((list) => {
        for (const entry of list.getEntries() as PerformanceEventTiming[]) {
          if (entry.name === "keydown") {
            store.keydown.push(entry.duration);
            store.processing.push(entry.processingEnd - entry.processingStart);
          }
        }
      });
      events.observe({ type: "event", durationThreshold: 16 } as PerformanceObserverInit);
      recorder.__perfObservers.push(events);
    };
    // Both windows share one main thread: observe long tasks in the app window only, or each
    // would be counted twice.
    record(window, true);
    const frame = document.querySelector<HTMLIFrameElement>(".editor__canvas iframe");
    if (frame?.contentWindow) record(frame.contentWindow, false);
  });
}

type Observed = { longTasks: number[]; keydown: number[]; processing: number[] };

/** Collects and resets what the observers saw since {@link startObservers}. */
async function takeObserved(): Promise<Observed> {
  return page.evaluate(() => {
    const frame = document.querySelector<HTMLIFrameElement>(".editor__canvas iframe");
    const stores = [window, frame?.contentWindow].map(
      (target) => (target as unknown as { __perf?: Record<string, number[]> } | null)?.__perf,
    );
    const take = (key: string) =>
      stores.flatMap((store) => (store?.[key] ?? []).splice(0)).map((d) => Math.round(d));
    return {
      longTasks: take("longtask"),
      keydown: take("keydown"),
      processing: take("processing"),
    };
  });
}

/**
 * Clicks `selector` in the app window `runs` times and measures, each time, how long until the
 * canvas DOM changed and the next frame was painted.
 */
async function timeClicks(selector: string, runs: number): Promise<number[]> {
  return page.evaluate(
    async ({ selector: target, runs: count }) => {
      const frame = document.querySelector<HTMLIFrameElement>(".editor__canvas iframe");
      const doc = frame?.contentDocument;
      if (!doc) throw new Error("No canvas");
      const times: number[] = [];
      for (let i = 0; i < count; i++) {
        const button = document.querySelector<HTMLElement>(target);
        if (!button) throw new Error(`Missing ${target}`);
        const changed = new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            observer.disconnect();
            reject(new Error("Canvas did not change"));
          }, 5_000);
          // Only changes to the page itself count, not Puck's overlays (outlines, drop zones).
          const observer = new MutationObserver((mutations) => {
            const onPage = mutations.some((m) => {
              // A text change targets a Text node; look from its element.
              const element =
                m.target.nodeType === Node.ELEMENT_NODE ? m.target : m.target.parentNode;
              return (element as Element | null)?.closest(".site-section") != null;
            });
            if (!onPage) return;
            observer.disconnect();
            clearTimeout(timer);
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          });
          observer.observe(doc.body, { subtree: true, childList: true, characterData: true });
        });
        const start = performance.now();
        button.click();
        await changed;
        times.push(performance.now() - start);
      }
      return times;
    },
    { selector, runs },
  );
}

test.beforeAll(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await page.waitForFunction(() => (window as PerfWindow).__webforgePerf !== undefined, null, {
    timeout: 10_000,
  });
  // The drag and history steps read the Undo History panel, a tab of the left panels (1.25).
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Undo History" })
    .click();
});

test.afterAll(async () => {
  results.machine = {
    platform: process.platform,
    cpu: cpus()[0]?.model,
    cores: cpus().length,
    memoryGb: Math.round(totalmem() / 2 ** 30),
  };
  // Not in test-results/: Playwright empties that folder at the start of every run.
  const dir = join(import.meta.dirname, "../perf-results");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "large-page.json"), `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify(results, null, 2));
  await app.close();
});

/** Types `text` into an inline heading and returns what the observers saw meanwhile. */
async function typeInto(heading: Locator, text: string) {
  await heading.click();
  await page.keyboard.press("End");
  await takeObserved();
  await page.keyboard.type(text, { delay: 60 });
  await expect(heading).toContainText(text.trim());
  const observed = await takeObserved();
  // Leave the text, as clicking elsewhere would (the title bar is a drag region since #110).
  await heading.blur();
  // Keydowns faster than 16 ms are not reported by Event Timing; they count as within budget.
  const orZero = (values: number[]) => (values.length > 0 ? values : [0]);
  return {
    keystrokes: text.length,
    keydownToPaint: { ...summary(orZero(observed.keydown)), reported: observed.keydown.length },
    processing: summary(orZero(observed.processing)),
    overBudget: observed.processing.filter((d) => d > FRAME_BUDGET_MS).length,
    longTasks: observed.longTasks,
  };
}

// One test with steps: every measurement runs and is recorded even when an earlier one misses its
// budget (expect.soft), which a serial suite would skip.
test("a page with 200+ elements against the editing budgets", async () => {
  const typed = " and some more words typed one by one";

  await test.step("baseline: typing on the small starter page", async () => {
    // The site CSS changes the layout when it arrives (1.12); measure with the final one.
    await expect(canvasFrame().locator("style[data-webforge-site-css]")).toHaveCount(1);
    await startObservers();
    results.typingStarterPage = await typeInto(
      canvasFrame().locator(".site-heading [contenteditable]").first(),
      typed,
    );
  });

  await test.step("load the large page into the canvas", async () => {
    const big = largePage({ sections: SECTIONS, questionsPerSection: QUESTIONS });
    const start = Date.now();
    await page.evaluate((doc) => (window as PerfWindow).__webforgePerf?.loadPage(doc), big);
    await expect(canvasFrame().locator(".site-section")).toHaveCount(SECTIONS, {
      timeout: 30_000,
    });
    results.load = { nodes: countNodes(big), ms: Date.now() - start };
    // The FAQs bring new classes: wait for the recompiled site CSS (daisyUI's collapse).
    await expect
      .poll(
        () =>
          canvasFrame()
            .locator("style[data-webforge-site-css]")
            .evaluate((style) => style.textContent ?? ""),
        { timeout: 30_000 },
      )
      .toContain(".collapse");
    await startObservers();
  });

  await test.step("typing in a heading: within a frame per keystroke (§10)", async () => {
    const typing = await typeInto(
      canvasFrame().locator(".site-section").last().locator(".site-heading [contenteditable]"),
      typed,
    );
    results.typing = typing;
    expect.soft(typing.overBudget, "keystrokes whose handlers took over a frame").toBe(0);
    expect.soft(typing.longTasks, "long tasks while typing").toEqual([]);
  });

  await test.step("dragging an element: one smooth step (§10)", async () => {
    const section = canvasFrame().locator(".site-section").nth(1);
    // Typing at the bottom of the page left the canvas scrolled away from this section.
    await section.scrollIntoViewIfNeeded();
    const from = await section.locator(".site-heading").boundingBox();
    const to = await section.locator(".site-text").last().boundingBox();
    if (from === null || to === null) throw new Error("Drag source or target not visible");
    await takeObserved();

    const start = Date.now();
    // Pressed past the end of the heading's text: pressing on the text selects it instead.
    const grab = { x: from.x + from.width * 0.97, y: from.y + from.height / 2 };
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(grab.x + 10, grab.y + 10, { steps: 5 });
    // Just inside the text's lower edge, which is a drop target whatever the Section's padding.
    await page.mouse.move(to.x + to.width / 2, to.y + to.height - 3, { steps: 25 });
    await page.mouse.up();
    await expect(page.locator(".undo-history__step").first()).toHaveText("Moved Heading");
    const observed = await takeObserved();

    results.drag = { totalMs: Date.now() - start, ...observed };
    expect.soft(observed.longTasks, "long tasks while dragging").toEqual([]);
  });

  await test.step("undo, redo and jumps: instant (U7)", async () => {
    const before = await page.locator(".undo-history__step").count();
    await page.evaluate(
      (count) => (window as PerfWindow).__webforgePerf?.addSteps(count),
      HISTORY_STEPS,
    );
    await expect(page.locator(".undo-history__step")).toHaveCount(before + HISTORY_STEPS);

    // The title bar's Undo and Redo (#110).
    const undo = await timeClicks('[data-slot="title-bar"] button[aria-label="Undo"]', 10);
    const redo = await timeClicks('[data-slot="title-bar"] button[aria-label="Redo"]', 10);
    const jumpToStart = await timeClicks("li:last-child > .undo-history__step", 1);
    const jumpToEnd = await timeClicks("li:first-child > .undo-history__step", 1);

    results.history = {
      steps: HISTORY_STEPS,
      undo: summary(undo),
      redo: summary(redo),
      jumpToStartMs: Math.round(jumpToStart[0] ?? 0),
      jumpToEndMs: Math.round(jumpToEnd[0] ?? 0),
    };
    expect.soft(p(undo, 0.95), "undo p95 (ms)").toBeLessThan(INSTANT_MS);
    expect.soft(p(redo, 0.95), "redo p95 (ms)").toBeLessThan(INSTANT_MS);
    expect.soft(Math.max(...jumpToStart, ...jumpToEnd), "jump (ms)").toBeLessThan(INSTANT_MS);
  });

  await test.step("memory", async () => {
    const heapMb = await page.evaluate(() => {
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      return memory === undefined ? null : Math.round(memory.usedJSHeapSize / 2 ** 20);
    });
    const rendererMb = await app.evaluate(({ app: electronApp, BrowserWindow }) => {
      const pid = BrowserWindow.getAllWindows()[0]?.webContents.getOSProcessId();
      const metric = electronApp.getAppMetrics().find((m) => m.pid === pid);
      return metric === undefined ? null : Math.round(metric.memory.workingSetSize / 1024);
    });
    results.memory = { jsHeapMb: heapMb, rendererWorkingSetMb: rendererMb };
  });
});
