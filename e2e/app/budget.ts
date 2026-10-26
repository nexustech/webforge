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
 * The wall-clock backstop for opening a site: twice the product's 3 s, so a busy machine doesn't
 * trip it, while a wait added to the path (a timer, a lost event) does.
 */
const OPEN_WALL_BACKSTOP_MS = 6_000;

/**
 * The CPU time opening a site may cost, across Webforge's processes: about 30% over the most CI's
 * runners measured (ADR 0014). Provisional until CI's first run measures it.
 */
const OPEN_CPU_SECONDS = 60;

/** Opening a site's budget: its CPU time, and the wall-clock backstop. */
export const OPEN_BUDGET = { cpuSeconds: OPEN_CPU_SECONDS, wallMs: OPEN_WALL_BACKSTOP_MS } as const;

/** CPU seconds each of Webforge's processes has used so far, by process id. */
async function cpuSoFar(app: ElectronApplication): Promise<Map<number, number>> {
  const metrics = await app.evaluate(({ app: electronApp }) =>
    electronApp.getAppMetrics().map((metric) => ({
      pid: metric.pid,
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
  return new Map(metrics.map((metric) => [metric.pid, metric.cpu ?? 0]));
}

/** What an operation cost: its wall-clock time and the CPU time Webforge spent on it. */
export type Work = { readonly wallMs: number; readonly cpuSeconds: number };

/**
 * Starts measuring an operation; the returned function ends it. The CPU time is every process's
 * use between the two, a process that started meanwhile (the export worker) from 0. One that exits
 * meanwhile is lost, so the count can only come out low.
 */
export async function measureWork(app: ElectronApplication): Promise<() => Promise<Work>> {
  const before = await cpuSoFar(app);
  const started = Date.now();
  return async () => {
    const wallMs = Date.now() - started;
    const after = await cpuSoFar(app);
    let cpuSeconds = 0;
    for (const [pid, cpu] of after) cpuSeconds += cpu - (before.get(pid) ?? 0);
    return { wallMs, cpuSeconds };
  };
}

/**
 * Checks an operation's work against its CPU budget and its wall-clock backstop, and prints both
 * (in the report and the log), so CI's runs show what each costs.
 */
export function expectWorkWithin(
  work: Work,
  budget: { readonly cpuSeconds: number; readonly wallMs: number },
  what: string,
): void {
  const cpu = work.cpuSeconds.toFixed(2);
  const line = `${what}: ${cpu} CPU-s of ${budget.cpuSeconds}, ${work.wallMs} ms of ${budget.wallMs} (${process.platform})`;
  test.info().annotations.push({ type: "work", description: line });
  console.log(`[work] ${line}`);
  if (work.cpuSeconds > budget.cpuSeconds) {
    throw new Error(`${what} cost ${cpu} CPU-s, over its ${budget.cpuSeconds} CPU-s budget`);
  }
  if (work.wallMs > budget.wallMs) {
    throw new Error(`${what} took ${work.wallMs} ms, over its ${budget.wallMs} ms backstop`);
  }
}
