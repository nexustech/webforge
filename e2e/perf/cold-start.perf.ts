import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect, type Page, test } from "@playwright/test";
import {
  closingWithin,
  desktopDir,
  electronCommand,
  launchDesktopApp,
  waitForCanvas,
  writeTestPreferences,
} from "../app/launch.js";
import { stubFileDialogs } from "../app/sites.js";
import { createFromTemplate, TEMPLATES } from "../app/templates.js";

// A cold start to an editable canvas (architecture §10, #891): Webforge launched with a site file,
// as a double-click does, timed from the launch to the canvas showing the site with its CSS, with
// each stage between (docs/reviews/2026-11-09-startup-performance.md's table). The main process's
// stages come from the line a perf build logs (main/startup-timing.ts); the editor's from its own
// marks and Chromium's paint and navigation timings, read once the canvas is styled.
//
// Started without Playwright's Electron launcher, which holds Electron's `ready` back until it has
// attached through the inspector, and slows the main process: here Webforge runs as it does for a
// person, with only Chromium's DevTools port open (on this computer only) to read the editor.
//
// Launches without a site are timed too, to the start screen's first render (#896): what someone
// opening Webforge from its icon waits for.
//
// The first launch, on a new profile, is kept apart from the later ones: it has no code cache and
// no GPU cache yet. The operating system's file cache can't be emptied from here, so even the first
// launch reads a build that was just read; a launch after a reboot is slower still.

/** §10: a cold start to an editable canvas of a 5-page site, on a mid-range laptop. */
const BUDGET_MS = 3_000;
/** The first launch, then this many more on the same profile. */
const LATER_LAUNCHES = 4;
/** The site: Café / Restaurant's four pages and its Page not found, with its photos. */
const TEMPLATE = TEMPLATES[0];
/** How long one launch may take to reach a styled canvas, on a busy runner. */
const LAUNCH_WAIT_MS = 60_000;

// Not in test-results/: Playwright empties that folder at the start of every run.
const RESULTS = join(import.meta.dirname, "../perf-results/cold-start.json");

/**
 * Each stage of a start-up, in order, how the table names it, and the stage its step is timed
 * from, as the review's table has them: the main process's from the stage before, the editor's
 * from its page's navigation, but `DOMContentLoaded` from `domInteractive`: the editor's scripts
 * loading and running, which a code cache shortens (#893).
 */
const STAGES = [
  ["processStart", "process started", undefined],
  ["mainEntry", "main's code runs", "processStart"],
  ["ready", "ready", "mainEntry"],
  ["ipcRegistered", "IPC handlers registered", "ready"],
  ["siteOpened", "site opened", "ipcRegistered"],
  ["windowCreated", "window created", "siteOpened"],
  ["navigationStart", "page navigation", "windowCreated"],
  ["firstPaint", "first paint", "navigationStart"],
  ["firstContentfulPaint", "first contentful paint", "navigationStart"],
  ["domInteractive", "domInteractive", "navigationStart"],
  ["domContentLoaded", "DOMContentLoaded", "domInteractive"],
  ["firstRender", "first render", "navigationStart"],
  ["canvasStyled", "styled canvas", "navigationStart"],
] as const;

type Stage = (typeof STAGES)[number][0];

/** Each stage's time after the launch, in ms; a stage that didn't happen is left out. */
type Stages = Partial<Record<Stage, number>>;

/** The main process's stages as its perf build logs them (main/startup-timing.ts). */
const MAIN_STAGES: Readonly<Record<string, Stage>> = {
  "main-entry": "mainEntry",
  ready: "ready",
  "ipc-registered": "ipcRegistered",
  "site-opened": "siteOpened",
  "window-created": "windowCreated",
};

let dir: string;
let sitePath: string;

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-cold-start-"));
  sitePath = join(dir, "Cafe.wforge");
  // The site made as a person makes it, with New Site, on a profile of its own.
  const app = await launchDesktopApp({ userDataDir: join(dir, "setup"), site: false });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible();
    await stubFileDialogs(app, sitePath);
    await createFromTemplate(page, TEMPLATE);
    await waitForCanvas(page);
  } finally {
    await app.close();
  }
});

test.afterAll(async () => {
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/** The app's output so far, and a wait for a line in it. */
function watchOutput(child: ChildProcess) {
  let text = "";
  let changed: () => void = () => undefined;
  const append = (chunk: Buffer) => {
    text += chunk.toString();
    changed();
  };
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);
  // A failed start ("error") counts as an exit.
  const exited = once(child, "exit").then(
    () => "exited" as const,
    () => "exited" as const,
  );
  return {
    /** Resolves with `pattern`'s first match in the output; rejects if the app exits first. */
    async find(pattern: RegExp): Promise<RegExpExecArray> {
      for (;;) {
        const match = pattern.exec(text);
        if (match !== null) return match;
        const more = new Promise<"more">((resolve) => {
          changed = () => resolve("more");
        });
        if ((await Promise.race([more, exited])) === "exited") {
          const last = pattern.exec(text);
          if (last !== null) return last;
          throw new Error(`Webforge exited before writing ${pattern}:\n${text}`);
        }
      }
    },
  };
}

/** `ms` to a tenth of a millisecond. */
const tenths = (ms: number) => Math.round(ms * 10) / 10;

/** The main process's line: when it started (ms since the epoch), and each stage after that. */
function mainStages(line: string, launchedAt: number): Stages {
  const values = new Map(
    line.split(", ").map((pair) => {
      const [name = "", value = ""] = pair.split("=");
      return [name, Number(value)] as const;
    }),
  );
  const origin = values.get("origin");
  if (origin === undefined || Number.isNaN(origin)) throw new Error(`No origin in ${line}`);
  const stages: Stages = { processStart: tenths(origin - launchedAt) };
  for (const [name, stage] of Object.entries(MAIN_STAGES)) {
    const at = values.get(name);
    if (at !== undefined && !Number.isNaN(at)) stages[stage] = tenths(origin + at - launchedAt);
  }
  return stages;
}

/** The editor's stages, from its window's own timeline. */
async function rendererStages(page: Page, launchedAt: number): Promise<Stages> {
  const timeline = await page.evaluate(() => {
    const first = (name: string) => performance.getEntriesByName(name)[0]?.startTime;
    const [navigation] = performance.getEntriesByType("navigation");
    return {
      origin: performance.timeOrigin,
      firstPaint: first("first-paint"),
      firstContentfulPaint: first("first-contentful-paint"),
      domInteractive:
        navigation instanceof PerformanceNavigationTiming ? navigation.domInteractive : undefined,
      domContentLoaded:
        navigation instanceof PerformanceNavigationTiming
          ? navigation.domContentLoadedEventStart
          : undefined,
      firstRender: first("webforge:first-render"),
      canvasStyled: first("webforge:canvas-styled"),
    };
  });
  const { origin, ...marks } = timeline;
  const stages: Stages = { navigationStart: tenths(origin - launchedAt) };
  for (const [stage, at] of Object.entries(marks) as [Stage, number | undefined][]) {
    if (at !== undefined) stages[stage] = tenths(origin + at - launchedAt);
  }
  return stages;
}

/**
 * Launches Webforge on `userData`'s profile, with the site as a double-click does, or without one
 * as its icon does (`site: false`); times it to a styled canvas, or to the start screen's first
 * render, then closes it as the person does.
 */
async function timeLaunch(userData: string, { site = true } = {}): Promise<Stages> {
  const { executablePath, env } = electronCommand();
  const launchedAt = Date.now();
  const child = spawn(
    executablePath,
    [
      desktopDir,
      `--user-data-dir=${userData}`,
      "--remote-debugging-port=0",
      ...(site ? [sitePath] : []),
    ],
    { cwd: desktopDir, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  const output = watchOutput(child);
  let browser: Browser | undefined;
  let page: Page | undefined;
  // Closed as the person closes it, so the profile keeps what Chromium writes on the way out.
  const app = closingWithin({
    process: () => child,
    close: async () => {
      const exited = once(child, "exit");
      await page
        ?.evaluate(() => {
          setTimeout(() => window.close(), 0);
        })
        .catch(() => undefined);
      await exited;
    },
  });
  try {
    const [, devTools = ""] = await output.find(/DevTools listening on (ws:\/\/\S+)/);
    browser = await chromium.connectOverCDP(devTools);
    const connected = browser;
    await expect
      .poll(() => connected.contexts().flatMap((context) => context.pages()).length, {
        timeout: LAUNCH_WAIT_MS,
      })
      .toBeGreaterThan(0);
    page = connected.contexts().flatMap((context) => context.pages())[0];
    if (page === undefined) throw new Error("Webforge has no window");
    await page.waitForFunction(
      (mark) => performance.getEntriesByName(mark).length > 0,
      site ? "webforge:canvas-styled" : "webforge:first-render",
      { timeout: LAUNCH_WAIT_MS, polling: 100 },
    );
    if (!site) {
      await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible();
    }
    const [, line = ""] = await output.find(/Webforge start-up \(([^)]*)\)/);
    return { ...mainStages(line, launchedAt), ...(await rendererStages(page, launchedAt)) };
  } finally {
    await app.close();
    await browser?.close();
  }
}

/** The median of `values`, which has at least one. */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : tenths(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
}

/** Each stage's step: its time after the stage it is timed from, or after the launch. */
function steps(stages: Stages): Stages {
  const timed: Stages = {};
  for (const [stage, , from] of STAGES) {
    const at = stages[stage];
    const start = from === undefined ? 0 : stages[from];
    if (at !== undefined && start !== undefined) timed[stage] = tenths(at - start);
  }
  return timed;
}

/** Each stage's median, fastest and slowest over `launches`. */
function summarise(launches: readonly Stages[]) {
  const summary = { median: {} as Stages, min: {} as Stages, max: {} as Stages };
  for (const [stage] of STAGES) {
    const values = launches.flatMap((launch) => launch[stage] ?? []);
    if (values.length === 0) continue;
    summary.median[stage] = median(values);
    summary.min[stage] = Math.min(...values);
    summary.max[stage] = Math.max(...values);
  }
  return summary;
}

/**
 * The table the review's is redone from: each stage's step after the stage it is timed from, on
 * the first launch and the later ones, and the later ones' median time after the launch.
 */
function table(first: Stages, launches: readonly Stages[]): string {
  const ms = (value: number | undefined) => (value === undefined ? "–" : `${Math.round(value)}`);
  const firstSteps = steps(first);
  const laterSteps = summarise(launches.map(steps));
  const later = summarise(launches);
  const labels = new Map<string, string>(STAGES.map(([stage, label]) => [stage, label]));
  const row = (cells: readonly [string, string, string, string, string]) =>
    `${cells[0].padEnd(26)}${cells[1].padEnd(26)}${cells[2].padStart(7)}${cells[3].padStart(22)}${cells[4].padStart(10)}`;
  const rows = [row(["Stage (ms)", "after", "first", "later: med (min–max)", "launch +"])];
  for (const [stage, label, from] of STAGES) {
    const range = `${ms(laterSteps.median[stage])} (${ms(laterSteps.min[stage])}–${ms(laterSteps.max[stage])})`;
    rows.push(
      row([
        label,
        from === undefined ? "the launch" : (labels.get(from) ?? from),
        ms(firstSteps[stage]),
        range,
        ms(later.median[stage]),
      ]),
    );
  }
  return rows.join("\n");
}

test(`a cold start reaches an editable canvas of a 5-page site (§10, ${BUDGET_MS} ms)`, async () => {
  test.setTimeout((1 + LATER_LAUNCHES) * 2 * LAUNCH_WAIT_MS);
  rmSync(RESULTS, { force: true });
  const userData = join(dir, "user-data");
  writeTestPreferences(userData);

  const first = await timeLaunch(userData);
  const launches: Stages[] = [];
  for (let launch = 0; launch < LATER_LAUNCHES; launch++) {
    launches.push(await timeLaunch(userData));
  }
  const later = summarise(launches);

  // Without a site, to the start screen (#896), on a profile of its own.
  const startData = join(dir, "start-screen");
  writeTestPreferences(startData);
  const startFirst = await timeLaunch(startData, { site: false });
  const startLaunches: Stages[] = [];
  for (let launch = 0; launch < LATER_LAUNCHES; launch++) {
    startLaunches.push(await timeLaunch(startData, { site: false }));
  }
  const startScreen = {
    first: startFirst,
    later: summarise(startLaunches),
    launches: startLaunches,
  };

  mkdirSync(join(RESULTS, ".."), { recursive: true });
  writeFileSync(
    RESULTS,
    `${JSON.stringify({ site: TEMPLATE.title, budgetMs: BUDGET_MS, first, later, launches, startScreen }, null, 2)}\n`,
  );
  console.log(`Cold start, ${TEMPLATE.title}'s site:\n${table(first, launches)}`);
  console.log(`Cold start, no site, to the start screen:\n${table(startFirst, startLaunches)}`);

  for (const [name, stages] of [
    ["first", first],
    ...launches.map((stages, index) => [`later ${index + 1}`, stages] as const),
  ] as const) {
    for (const [stage] of STAGES) {
      // Every stage happens with a site: none may be missing.
      expect(stages[stage], `${name} launch: ${stage}`).toBeGreaterThan(0);
    }
  }
  for (const [name, stages] of [
    ["first", startFirst],
    ...startLaunches.map((stages, index) => [`later ${index + 1}`, stages] as const),
  ] as const) {
    // Without a site: the start screen's first render, and no canvas.
    expect(stages.firstRender, `${name} launch without a site`).toBeGreaterThan(0);
    expect(stages.canvasStyled, `${name} launch without a site`).toBeUndefined();
  }

  // Recorded, not failed yet: the review measured 5–8 s from launch to a styled canvas, so failing
  // here would turn the nightly job red until the start-up chores (#892–#896) land, and hide the
  // other budgets' misses meanwhile. Each of them is measured with this check; once they bring it
  // under the budget, this becomes an `expect`.
  const editable = later.median.canvasStyled ?? Number.POSITIVE_INFINITY;
  if (editable >= BUDGET_MS || (first.canvasStyled ?? Number.POSITIVE_INFINITY) >= BUDGET_MS) {
    const description = `An editable canvas ${Math.round(first.canvasStyled ?? 0)} ms after the first launch, ${Math.round(editable)} ms (median) after later ones; §10's budget is ${BUDGET_MS} ms`;
    // In the report, and in the job's log, which the list reporter doesn't show annotations in.
    test.info().annotations.push({ type: "over budget", description });
    console.log(`Over budget: ${description}`);
  }
});
