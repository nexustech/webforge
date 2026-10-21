import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
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
const KEEP = 20;
const MAX_AGE_DAYS = 30;
const SEEN_FILE = "last-seen.json";

const seenSchema = z.strictObject({ time: z.iso.datetime() });

function fileStamp(time: string): string {
  return time.slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
}

/**
 * The crash-reports folder (`userData/crash-reports`): writes reports, keeps the last 20 for at
 * most 30 days, and remembers which ones the user has been told about.
 */
export function createCrashReports(options: {
  readonly dir: string;
  readonly now?: () => Date;
  readonly keep?: number;
  readonly maxAgeDays?: number;
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

  const prune = () => {
    const cutoff = now().getTime() - maxAgeMs;
    for (const [index, report] of reports().entries()) {
      if (index >= keep || report.mtime < cutoff) {
        rmSync(report.path, { force: true });
      }
    }
  };

  return {
    dir: options.dir,
    /** Writes a report synchronously (the process may be about to exit) and prunes old ones. */
    write(report: CrashReport): string {
      mkdirSync(options.dir, { recursive: true });
      const base = `crash-${fileStamp(report.time)}`;
      let name = `${base}-${report.process}.json`;
      for (let n = 2; existsSync(join(options.dir, name)); n += 1) {
        name = `${base}-${n}-${report.process}.json`;
      }
      const path = join(options.dir, name);
      writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
      prune();
      return path;
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
      return reports().some((report) => report.mtime > seen);
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
