import type { ElectronApplication } from "@playwright/test";
import { test } from "@playwright/test";

// Time in tests (ADR 0014, #446, #489). Opening a site in under 3 s (spec/02, F-SITE-1) is the
// product's target, checked by `pnpm e2e:perf` on a quiet machine. Every other run shares its
// machine with whatever else runs (another worktree's checks, an install, CI's neighbours), so it
// checks what a busy machine doesn't move:
// - the work: the CPU time Webforge's processes spend on the operation ({@link measureWork}), set
//   from CI's runners with headroom;
// - a loose wall-clock backstop beside it, for time spent waiting, which costs no CPU (a timer, a
//   lost event, an IPC round trip in series);
// - generous waits ({@link OPEN_WAIT}), so a slow run fails on its budget, never on a wait.
// Nothing is retried.

/** How long a test waits for what a timed operation shows: far past any budget it checks. */
export const OPEN_WAIT = 30_000;

/**
 * How long a test waits for work the system does in its own time, such as Windows' spell checker
 * looking at a typed word (#446): a wait with no budget, slower when the machine is busy.
 */
export const BACKGROUND_WAIT = 45_000;

/**
 * The wall-clock backstop for opening a site: on CI, twice the product's 3 s, so a busy runner
 * doesn't trip it, while a wait added to the path (a timer, a lost event) does. Twice that again
 * locally, where other work shares the machine: openings took up to 5.3 s there under load.
 */
const OPEN_WALL_BACKSTOP_MS = process.env.CI === "true" ? 6_000 : 12_000;

/**
 * The CPU time opening a site may cost on CI's runners, across Webforge's processes, by platform:
 * about 30% over the most two CI runs measured (27 Oct 2026; runs 40408131521 and 40494487950).
 * Linux 1.75–3.31 CPU-s, Windows 1.64–2.85, macOS 1.36–3.26: GitHub's runners differ from run to
 * run, so one run's numbers aren't enough. See ADR 0014.
 */
const CI_OPEN_CPU_SECONDS: Readonly<Record<string, number>> = {
  linux: 4.3,
  win32: 3.7,
  darwin: 4.3,
};

/**
 * How much more CPU a local run may use than CI's: a development machine draws the canvas on a
 * larger, high-DPI screen and shares its CPU with other work, and opening a site cost it 2–3 times
 * as much (5.3–7.8 CPU-s on Windows). `WEBFORGE_E2E_CPU_SCALE` sets another factor.
 */
const LOCAL_CPU_SCALE = 3;

/** The local factor this run uses: `WEBFORGE_E2E_CPU_SCALE` when set (an empty one is unset). */
function localCpuScale(): number {
  const set = process.env.WEBFORGE_E2E_CPU_SCALE;
  const scale = set === undefined || set.trim() === "" ? LOCAL_CPU_SCALE : Number(set);
  if (!(scale > 0))
    throw new Error(`WEBFORGE_E2E_CPU_SCALE must be a positive number, not "${set}"`);
  return scale;
}

/** A CPU budget and a wall-clock backstop, and where the CPU budget comes from. */
export type Budget = {
  readonly cpuSeconds: number;
  readonly wallMs: number;
  /** Which budget it is, for a miss to say: CI's, or the local one. */
  readonly source: string;
};

/**
 * Opening a site's budget in this run: CI's CPU time for its platform, scaled when local, and the
 * wall-clock backstop. Worked out when a test checks it, so a spec that never does (spellcheck)
 * loads whatever the platform or settings.
 */
export function openBudget(): Budget {
  const ci = CI_OPEN_CPU_SECONDS[process.platform];
  if (ci === undefined) throw new Error(`No CPU budget for opening a site on ${process.platform}`);
  if (process.env.CI === "true") {
    return { cpuSeconds: ci, wallMs: OPEN_WALL_BACKSTOP_MS, source: `CI's on ${process.platform}` };
  }
  const scale = localCpuScale();
  return {
    cpuSeconds: Math.round(ci * scale * 100) / 100,
    wallMs: OPEN_WALL_BACKSTOP_MS,
    source: `local on ${process.platform}, CI's × ${scale}`,
  };
}

/** One of Webforge's processes: its id with its start, as a pid can be used again. */
type ProcessKey = string;

/** A process's CPU seconds so far, and its kind. */
type ProcessCpu = { readonly type: string; readonly cpu: number };

/** CPU seconds each of Webforge's processes has used so far, by process (pid and start time). */
async function cpuSoFar(app: ElectronApplication): Promise<Map<ProcessKey, ProcessCpu>> {
  const metrics = await app.evaluate(({ app: electronApp }) =>
    electronApp.getAppMetrics().map((metric) => ({
      key: `${metric.pid}@${metric.creationTime}`,
      type: metric.type,
      cpu: metric.cpu.cumulativeCPUUsage,
    })),
  );
  const missing = metrics.filter((metric) => metric.cpu === undefined);
  if (missing.length > 0) {
    // Optional in Electron's types: a platform without it can't check the work, and says so.
    throw new Error(
      `Electron gives no cumulativeCPUUsage for ${missing.map((metric) => metric.type).join(", ")} on ${process.platform}: the CPU budget can't be checked (ADR 0014)`,
    );
  }
  return new Map(
    metrics.map((metric) => [metric.key, { type: metric.type, cpu: metric.cpu ?? 0 }]),
  );
}

/**
 * What an operation cost: its wall-clock time, the CPU time Webforge spent on it, and the kinds of
 * the processes that exited meanwhile, whose time is lost.
 */
export type Work = {
  readonly wallMs: number;
  readonly cpuSeconds: number;
  readonly exited: readonly string[];
};

/**
 * Starts measuring an operation; the returned function ends it. The CPU time is every process's
 * use between the two: one that started meanwhile (the export worker), or reused an old one's pid,
 * from 0. One that exits meanwhile is lost, so the count can only come out low; it is named in
 * the result. Creating a site keeps its window's renderer (`exited` stays empty), so its work
 * counts in full.
 */
export async function measureWork(app: ElectronApplication): Promise<() => Promise<Work>> {
  const before = await cpuSoFar(app);
  const started = Date.now();
  return async () => {
    const wallMs = Date.now() - started;
    const after = await cpuSoFar(app);
    let cpuSeconds = 0;
    for (const [key, { cpu }] of after) cpuSeconds += cpu - (before.get(key)?.cpu ?? 0);
    const exited = [...before].filter(([key]) => !after.has(key)).map(([, { type }]) => type);
    return { wallMs, cpuSeconds, exited };
  };
}

/**
 * Checks an operation's work against its CPU budget and its wall-clock backstop, and prints both
 * (in the report and the log), so CI's runs show what each costs.
 */
export function expectWorkWithin(work: Work, budget: Budget, what: string): void {
  const cpu = work.cpuSeconds.toFixed(2);
  const lost =
    work.exited.length === 0 ? "" : `; exited meanwhile, not counted: ${work.exited.join(", ")}`;
  const line = `${what}: ${cpu} CPU-s of ${budget.cpuSeconds}, ${work.wallMs} ms of ${budget.wallMs} (${budget.source})${lost}`;
  test.info().annotations.push({ type: "work", description: line });
  console.log(`[work] ${line}`);
  if (work.cpuSeconds > budget.cpuSeconds) {
    throw new Error(
      `${what} cost ${cpu} CPU-s, over its ${budget.cpuSeconds} CPU-s (${budget.source})`,
    );
  }
  if (work.wallMs > budget.wallMs) {
    throw new Error(`${what} took ${work.wallMs} ms, over its ${budget.wallMs} ms backstop`);
  }
}
