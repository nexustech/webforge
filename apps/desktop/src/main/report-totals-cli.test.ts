import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaledTestTimeout } from "@webforge/test-utils/vitest";
import { afterAll, describe, expect, it } from "vitest";

// `pnpm report-totals <folder>` (5.42, BD-3) as the triage notes run it: Node, with the import
// hook that finds the desktop app's TypeScript, on a folder of reports. The adding up itself is
// tested in `report-totals.test.ts`.

const ROOT = join(import.meta.dirname, "../../../..");
const folder = mkdtempSync(join(tmpdir(), "report-totals-"));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

/** A usage summary with nothing counted but one start-up, as Save Report… writes it. */
const REPORT = {
  summary: {
    version: 1,
    installId: "0b6f1c1e-6c4a-4c39-9a7e-2f2d8a5a0c11",
    since: 0,
    saved: 5,
    sites: {
      started: { template: 1 },
      templates: {},
      firstEdits: 0,
      siteChecks: 0,
      previews: 0,
      phonePreviews: 0,
      exports: 0,
      published: {},
    },
    quickStart: { created: {}, cancelled: {} },
    tour: { taken: 0, declined: 0, finished: 0, closedAt: [] },
    used: { commands: {}, added: {} },
    failures: { export: {}, publish: {}, save: {}, files: {}, previews: 0, crashReports: 0 },
    siteCheck: { must: {}, should: {}, tip: {} },
    aiApps: { apps: {}, tools: {}, outcomes: {} },
    assistant: { messages: {}, tools: {}, toolStates: {} },
    timings: { startup: [{ at: 1, ms: 2_100 }], openSite: [], export: [], preview: [] },
  },
  crashReports: [],
};

describe("pnpm report-totals (5.42, BD-3)", () => {
  it(
    "prints the totals of a folder of reports, naming the one it refuses",
    () => {
      writeFileSync(join(folder, "report.json"), JSON.stringify(REPORT));
      writeFileSync(join(folder, "notes.txt"), "Thanks!");

      const run = spawnSync(
        process.execPath,
        [
          "--experimental-transform-types",
          "--no-warnings",
          "--import",
          "./tools/src/ts-imports.ts",
          "apps/desktop/src/main/report-totals-cli.ts",
          folder,
        ],
        { cwd: ROOT, encoding: "utf8", timeout: scaledTestTimeout(60_000) },
      );

      expect(run.stderr).toBe("");
      expect(run.status).toBe(0);
      expect(run.stdout).toContain("Reports: 1 installs, 1 refused");
      expect(run.stdout).toContain("  Refused notes.txt: not JSON");
      expect(run.stdout).toContain("  Started a site:   1 of 1 (100%)");
      expect(run.stdout).toContain("  startup: 1 samples from 1 installs, median 2100 ms");
    },
    scaledTestTimeout(90_000),
  );
});
