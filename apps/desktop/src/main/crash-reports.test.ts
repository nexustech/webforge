import { mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildCrashReport,
  type CrashContext,
  createCrashReports,
  redactPaths,
} from "./crash-reports.js";

const HOME = "C:\\Users\\Rosa Smith";
const APP = "C:\\Program Files\\Webforge\\resources\\app.asar";
const SITE_TEXT = "Rosa's secret sourdough recipe";

const context: CrashContext = {
  appVersion: "1.2.0",
  versions: { electron: "44.0.0", chrome: "142.0.0", node: "24.22.0" },
  os: { platform: "win32", arch: "x64", release: "10.0.26200" },
  appPath: APP,
  privatePaths: [HOME, `${HOME}\\AppData\\Roaming\\Webforge`],
  memory: () => ({ rss: 150 * 1_048_576, heapUsed: 42.25 * 1_048_576 }),
  now: () => new Date("2026-10-20T15:30:00.000Z"),
};

/** An error such as a document bug would throw: its message quotes site text and a path. */
function errorFromSite(): Error {
  const error = new TypeError(
    `Cannot read "${SITE_TEXT}" from ${HOME}\\Documents\\Rosa's Bakery.wforge`,
  );
  error.stack = [
    `TypeError: Cannot read "${SITE_TEXT}" from ${HOME}\\Documents\\Rosa's Bakery.wforge`,
    `    at readPage (${APP}\\out\\main\\index.js:120:7)`,
    `    at file:///${APP.replaceAll("\\", "/")}/out/main/index.js:88:3`,
    `    at open (${HOME}\\Documents\\plugin.js:1:1)`,
    "    at /Users/rosa/Sites/x.js:2:2",
    "    at \\\\fileserver\\share\\y.js:3:3",
    "    at node:internal/process/task_queues:95:5",
  ].join("\n");
  return error;
}

describe("buildCrashReport", () => {
  it("contains no site content, no message and no paths beyond the app's own", () => {
    const report = buildCrashReport(context, {
      process: "main",
      kind: "uncaught-exception",
      error: errorFromSite(),
    });
    const json = JSON.stringify(report);

    expect(json).not.toContain("sourdough");
    expect(json).not.toContain("Rosa");
    expect(json).not.toContain("Documents");
    expect(json).not.toContain("fileserver");
    expect(json).not.toContain("Users");
    expect(report.error).toEqual({
      name: "TypeError",
      stack: [
        "at readPage (<app>\\out\\main\\index.js:120:7)",
        "at <app>/out/main/index.js:88:3",
        "at open (<path>)",
        "at <path>",
        "at <path>",
        "at node:internal/process/task_queues:95:5",
      ],
    });
  });

  it("records the facts about the app, the process and memory", () => {
    const report = buildCrashReport(context, { process: "renderer", kind: "crashed", exitCode: 3 });

    expect(report).toEqual({
      time: "2026-10-20T15:30:00.000Z",
      process: "renderer",
      kind: "crashed",
      app: { version: "1.2.0" },
      versions: context.versions,
      os: context.os,
      exitCode: 3,
      memory: { rssMb: 150, heapUsedMb: 42.3 },
    });
  });

  it("records only the type of something thrown that isn't an Error", () => {
    const report = buildCrashReport(context, {
      process: "main",
      kind: "unhandled-rejection",
      error: SITE_TEXT,
    });

    expect(report.error).toEqual({ name: "string", stack: [] });
    expect(JSON.stringify(report)).not.toContain("sourdough");
  });
});

describe("redactPaths", () => {
  it("replaces private and unknown absolute paths whole, in both slash styles", () => {
    expect(redactPaths(`at x (${HOME}/AppData/a.js:1:1)`, APP, context.privatePaths)).toBe(
      "at x (<path>)",
    );
    expect(redactPaths("at y (D:\\Sites\\b.js:2:2)", APP, [])).toBe("at y (<path>)");
    expect(redactPaths("at z (/home/rosa/c.js:3:3)", APP, [])).toBe("at z (<path>)");
  });
});

describe("createCrashReports", () => {
  let dir: string;
  let clock: Date;
  let reports: ReturnType<typeof createCrashReports>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "webforge-crash-"));
    clock = new Date("2026-10-20T15:30:00.000Z");
    reports = createCrashReports({ dir, now: () => clock, keep: 3, maxAgeDays: 30 });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const report = (process: "main" | "renderer" = "main") =>
    buildCrashReport({ ...context, now: () => clock }, { process, kind: "crashed" });

  it("writes timestamped, Windows-safe report files", () => {
    const first = reports.write(report());
    const second = reports.write(report("renderer"));
    const third = reports.write(report());

    expect(first).toBe(join(dir, "crash-20261020-153000-main.json"));
    expect(second).toBe(join(dir, "crash-20261020-153000-renderer.json"));
    expect(third).toBe(join(dir, "crash-20261020-153000-2-main.json"));
    expect(JSON.parse(readFileSync(first, "utf8"))).toMatchObject({ process: "main" });
  });

  it("keeps the newest reports and none older than 30 days", () => {
    const paths = [1, 2, 3, 4].map((minute) => {
      clock = new Date(Date.UTC(2026, 9, 20, 15, minute));
      const path = reports.write(report());
      utimesSync(path, clock, clock);
      return path;
    });
    expect(readdirSync(dir).sort()).toEqual(
      paths
        .slice(1)
        .map((path) => path.slice(dir.length + 1))
        .sort(),
    );

    const old = new Date(Date.UTC(2026, 8, 1));
    for (const path of paths.slice(1)) utimesSync(path, old, old);
    reports.prune();

    expect(readdirSync(dir)).toEqual([]);
  });

  it("knows which reports the user hasn't been told about", () => {
    expect(reports.hasUnseen()).toBe(false);
    const path = reports.write(report());
    utimesSync(path, clock, clock);
    expect(reports.hasUnseen()).toBe(true);

    clock = new Date(clock.getTime() + 1_000);
    reports.markSeen();

    expect(reports.hasUnseen()).toBe(false);
  });
});
