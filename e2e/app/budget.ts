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
 * The CPU time opening a site may cost on CI's runners, across Webforge's processes, by platform:
 * about 30% over the most CI measured (run 40408131521, 27 Oct 2026: Linux 1.75–2.05 CPU-s,
 * Windows 2.23–2.85, macOS 2.09–3.26). See ADR 0014.
 */
const CI_OPEN_CPU_SECONDS: Readonly<Record<string, number>> = {
  linux: 2.7,
  win32: 3.7,
  darwin: 4.3,
};

/**
 * How much more CPU a local run may use than CI's: a development machine draws the canvas on a
 * larger, high-DPI screen and shares its CPU with other work, and opening a site cost it 2–3 times
 * as much (5.3–7.8 CPU-s on Windows). `WEBFORGE_E2E_CPU_SCALE` sets another factor.
 */
const LOCAL_CPU_SCALE = 3;

/** The CPU budget for opening a site in this run: CI's for its platform, scaled when local. */
function openCpuSeconds(): number {
  const ci = CI_OPEN_CPU_SECONDS[process.platform];
  if (ci === undefined) throw new Error(`No CPU budget for opening a site on ${process.platform}`);
  if (process.env.CI === "true") return ci;
  const scale = Number(process.env.WEBFORGE_E2E_CPU_SCALE ?? LOCAL_CPU_SCALE);
  if (!(scale > 0)) throw new Error("WEBFORGE_E2E_CPU_SCALE must be a positive number");
  return Math.round(ci * scale * 100) / 100;
}

/** Opening a site's budget: its CPU time, and the wall-clock backstop. */
export const OPEN_BUDGET = { cpuSeconds: openCpuSeconds(), wallMs: OPEN_WALL_BACKSTOP_MS } as const;

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
    const where =
      process.env.CI === "true"
        ? `CI's budget on ${process.platform}`
        : `the local budget on ${process.platform}, CI's × ${process.env.WEBFORGE_E2E_CPU_SCALE ?? LOCAL_CPU_SCALE}`;
    throw new Error(`${what} cost ${cpu} CPU-s, over its ${budget.cpuSeconds} CPU-s (${where})`);
  }
  if (work.wallMs > budget.wallMs) {
    throw new Error(`${what} took ${work.wallMs} ms, over its ${budget.wallMs} ms backstop`);
  }
}
