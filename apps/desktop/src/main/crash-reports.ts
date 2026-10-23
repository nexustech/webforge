import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { z } from "zod";

/** Which process a report is about. */
export type CrashProcess = "main" | "renderer" | "gpu" | "utility" | "other";

/**
 * A local crash report (F-SITE-7, architecture §9). It never holds site content, credentials or
 * personal data: no error messages (they can quote whatever the code was handling), no paths
 * outside the app's own folder, only error names, stack frames and facts about the app.
 */
export type CrashReport = {
  readonly time: string;
  readonly process: CrashProcess;
  /** `uncaught-exception`, `unhandled-rejection`, or Electron's reason a process went away. */
  readonly kind: string;
  readonly app: { readonly version: string };
  readonly versions: { readonly electron: string; readonly chrome: string; readonly node: string };
  readonly os: { readonly platform: string; readonly arch: string; readonly release: string };
  readonly error?: { readonly name: string; readonly stack: readonly string[] };
  readonly exitCode?: number;
  readonly memory: { readonly rssMb: number; readonly heapUsedMb: number };
};

/** Facts about the running app, read once at start-up. */
export type CrashContext = {
  readonly appVersion: string;
  readonly versions: CrashReport["versions"];
  readonly os: CrashReport["os"];
  /** Folders whose paths are replaced in stacks: the app's own (kept, made relative) and others. */
  readonly appPath: string;
  readonly privatePaths: readonly string[];
  readonly memory: () => { rss: number; heapUsed: number };
  readonly now?: () => Date;
};

const MAX_FRAMES = 30;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches a path in either slash style, as stacks print them (also `file:///…` URLs). With
 * `whole`, the rest of the path below it is matched too.
 */
function pathPattern(path: string, whole: boolean): RegExp {
  const parts = path
    .split(/[\\/]+/)
    .filter((part) => part !== "")
    .map(escapeRegExp);
  const rest = whole ? String.raw`[^\s)'"]*` : "";
  return new RegExp(String.raw`(?:file:/{2,3})?/?` + parts.join(String.raw`[\\/]+`) + rest, "gi");
}

/** Any other absolute path: `C:\…`, `\\server\…`, `/Users/…`, `/home/…` and the like. */
const OTHER_PATHS =
  /(?:file:\/{2,3})?(?:[A-Za-z]:[\\/]|\\\\|\/(?:Users|home|var|tmp|private|Volumes|mnt)\/)[^\s)'"]*/g;

/**
 * Replaces paths in one stack frame: the app's own folder becomes `<app>`, so frames still say
 * which module failed; everything else becomes `<path>`, since a path can name the user or a site.
 */
export function redactPaths(
  line: string,
  appPath: string,
  privatePaths: readonly string[],
): string {
  let result = line.replace(pathPattern(appPath, false), "<app>");
  for (const path of [...privatePaths].sort((a, b) => b.length - a.length)) {
    result = result.replace(pathPattern(path, true), "<path>");
  }
  return result.replace(OTHER_PATHS, "<path>");
}

/**
 * The stack frames of `error` without its message: V8 starts a stack with `Name: message`, and
 * the message may quote what the code was working on. Only `at …` lines are kept.
 */
function framesOf(error: Error, context: CrashContext): string[] {
  return (error.stack ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at "))
    .slice(0, MAX_FRAMES)
    .map((line) => redactPaths(line, context.appPath, context.privatePaths));
}

/** Builds a report; `error` is whatever was thrown (which need not be an `Error`). */
export function buildCrashReport(
  context: CrashContext,
  details: {
    readonly process: CrashProcess;
    readonly kind: string;
    readonly error?: unknown;
    readonly exitCode?: number;
  },
): CrashReport {
  const memory = context.memory();
  const mb = (bytes: number) => Math.round((bytes / 1_048_576) * 10) / 10;
  const error =
    details.error === undefined
      ? undefined
      : details.error instanceof Error
        ? { name: details.error.name, stack: framesOf(details.error, context) }
        : // A thrown string or object: its type only, never its value.
          { name: typeof details.error, stack: [] };
  return {
    time: (context.now?.() ?? new Date()).toISOString(),
    process: details.process,
    kind: details.kind,
    app: { version: context.appVersion },
    versions: context.versions,
    os: context.os,
    ...(error === undefined ? {} : { error }),
    ...(details.exitCode === undefined ? {} : { exitCode: details.exitCode }),
    memory: { rssMb: mb(memory.rss), heapUsedMb: mb(memory.heapUsed) },
  };
}

/** `crash-20261020-153000-main.json`: UTC, Windows-safe (architecture §9). */
const REPORT_NAME = /^crash-\d{8}-\d{6}(?:-\d+)?-[a-z]+\.json$/;
/** A report being written: it gets its name once it is whole, so no one reads half of it. */
const PARTIAL_SUFFIX = ".tmp";
/** How long a `.tmp` report may be in the writing before it counts as left behind. */
const STALE_PARTIAL_MS = 60_000;
/** The pause before trying a locked rename again. */
const RENAME_RETRY_MS = 100;

/** Whether `error` is Windows holding a file for a moment (antivirus, the search indexer). */
const isLocked = (error: unknown) =>
  error instanceof Error &&
  "code" in error &&
  (error.code === "EPERM" || error.code === "EBUSY" || error.code === "EACCES");

/** Waits `ms` without returning to the event loop: a crash report is written as the app exits. */
function pauseSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
const KEEP = 20;
const MAX_AGE_DAYS = 30;
const SEEN_FILE = "last-seen.json";

const seenSchema = z.strictObject({ time: z.iso.datetime() });

/**
 * What a report must have to count as one: a file cut short (a crash while an older version was
 * writing it) or not a report at all doesn't. Other fields may differ between versions.
 */
const reportSchema = z.object({
  time: z.iso.datetime(),
  process: z.enum(["main", "renderer", "gpu", "utility", "other"]),
  kind: z.string(),
});

/** Whether the file at `path` holds a whole, readable report. */
function isReport(path: string): boolean {
  try {
    return reportSchema.safeParse(JSON.parse(readFileSync(path, "utf8"))).success;
  } catch {
    return false;
  }
}

function fileStamp(time: string): string {
  return time.slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
}

/**
 * The crash-reports folder (`userData/crash-reports`): writes reports, keeps the last 20 for at
 * most 30 days, and remembers which ones the user has been told about. A report is written under a
 * `.tmp` name and renamed once whole, so a half-written one is never taken for a report.
 */
export function createCrashReports(options: {
  readonly dir: string;
  readonly now?: () => Date;
  readonly keep?: number;
  readonly maxAgeDays?: number;
  /** Renames a file; `renameSync` but in tests. */
  readonly rename?: (from: string, to: string) => void;
  /** Waits before a retry; a real pause but in tests. */
  readonly pause?: (ms: number) => void;
}) {
  const now = options.now ?? (() => new Date());
  const keep = options.keep ?? KEEP;
  const maxAgeMs = (options.maxAgeDays ?? MAX_AGE_DAYS) * 24 * 60 * 60 * 1_000;

  /** Report files, newest first. */
  const reports = () =>
    existsSync(options.dir)
      ? readdirSync(options.dir)
          .filter((name) => REPORT_NAME.test(name))
          .map((name) => ({
            path: join(options.dir, name),
            mtime: statSync(join(options.dir, name)).mtimeMs,
          }))
          .sort((a, b) => b.mtime - a.mtime)
      : [];

  const rename = options.rename ?? renameSync;
  const pause = options.pause ?? pauseSync;

  /**
   * Gives a whole report at `partial` its name `path`. Antivirus or a search indexer can hold a
   * new file on Windows for a moment: one more try after a pause. False if it still can't.
   */
  const finish = (partial: string, path: string): boolean => {
    try {
      rename(partial, path);
      return true;
    } catch (error) {
      if (!isLocked(error)) return false;
    }
    pause(RENAME_RETRY_MS);
    try {
      rename(partial, path);
      return true;
    } catch {
      return false;
    }
  };

  /**
   * Removes old reports. A report left as `.tmp` for over a minute (a crash, or a rename that
   * failed) gets its name if it is whole, and goes if not; a newer one may still be being written,
   * by this Webforge or another starting up, so it stays.
   */
  const prune = () => {
    const cutoff = now().getTime() - maxAgeMs;
    for (const [index, report] of reports().entries()) {
      if (index >= keep || report.mtime < cutoff) {
        rmSync(report.path, { force: true });
      }
    }
    if (!existsSync(options.dir)) {
      return;
    }
    for (const name of readdirSync(options.dir)) {
      if (!name.endsWith(`.json${PARTIAL_SUFFIX}`)) continue;
      const partial = join(options.dir, name);
      if (statSync(partial).mtimeMs > now().getTime() - STALE_PARTIAL_MS) continue;
      const path = partial.slice(0, -PARTIAL_SUFFIX.length);
      if (existsSync(path) || !isReport(partial) || !finish(partial, path)) {
        rmSync(partial, { force: true });
      }
    }
  };

  return {
    dir: options.dir,
    /** Writes a report synchronously (the process may be about to exit) and prunes old ones. */
    write(report: CrashReport): string {
      mkdirSync(options.dir, { recursive: true });
      const base = `crash-${fileStamp(report.time)}`;
      const taken = (name: string) =>
        existsSync(join(options.dir, name)) ||
        existsSync(join(options.dir, `${name}${PARTIAL_SUFFIX}`));
      let name = `${base}-${report.process}.json`;
      for (let n = 2; taken(name); n += 1) {
        name = `${base}-${n}-${report.process}.json`;
      }
      // The name is new, so the rename never replaces a report (which fails on Windows anyway).
      const path = join(options.dir, name);
      const partial = `${path}${PARTIAL_SUFFIX}`;
      writeFileSync(partial, `${JSON.stringify(report, null, 2)}\n`);
      // If it can't get its name, it stays whole as `.tmp`: a later start names it.
      const written = finish(partial, path) ? path : partial;
      prune();
      return written;
    },
    /** Whether reports were written since the user was last told (next-launch notice). */
    hasUnseen(): boolean {
      let seen = 0;
      try {
        seen = Date.parse(
          seenSchema.parse(JSON.parse(readFileSync(join(options.dir, SEEN_FILE), "utf8"))).time,
        );
      } catch {
        // Never told: every report is new.
      }
      return reports().some((report) => report.mtime > seen && isReport(report.path));
    },
    /** Remembers that the user has been told about every report so far. */
    markSeen(): void {
      mkdirSync(options.dir, { recursive: true });
      writeFileSync(join(options.dir, SEEN_FILE), JSON.stringify({ time: now().toISOString() }));
    },
    prune,
  };
}

/** See {@link createCrashReports}. */
export type CrashReports = ReturnType<typeof createCrashReports>;
