import { readdirSync } from "node:fs";
import { defineConfig } from "vitest/config";

type Thresholds = { lines: number; branches: number; functions: number; statements: number };

/** Core logic is held to a higher bar (engineering standards §5). */
const CORE_PACKAGES = new Set([
  "model",
  "history",
  "storage",
  "pipeline",
  "publish",
  "commands",
  "site-check",
]);
const CORE: Thresholds = { lines: 90, branches: 85, functions: 90, statements: 90 };
const DEFAULT: Thresholds = { lines: 80, branches: 80, functions: 80, statements: 80 };

const workspaces = [
  ...["apps", "packages"].flatMap((group) =>
    readdirSync(group, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ path: `${group}/${entry.name}`, name: entry.name })),
  ),
  { path: "tools", name: "tools" },
];

export default defineConfig({
  test: {
    projects: workspaces.map((ws) => ws.path),
    // Half the CPU threads, not all but one. The DOM-heavy desktop tests are CPU-bound, and with a
    // worker on almost every thread they timed out whenever anything else ran beside them (another
    // session's checks or E2E). Three runs at once: 5 timeouts before, none after, at the same
    // wall time; and a run on its own is no slower.
    maxWorkers: "50%",
    coverage: {
      provider: "v8",
      include: workspaces.map((ws) => `${ws.path}/src/**/*.{ts,tsx}`),
      exclude: [
        "**/*.test.{ts,tsx}",
        // Storybook stories are checked by e2e/visual (axe and screenshots), not unit coverage.
        "**/*.stories.tsx",
        // Fakes and helpers that only tests import (e.g. fake-engine, fake-netlify).
        "**/*.test-helper.{ts,tsx}",
        "**/*.d.ts",
        // Process entry points only wire tested modules together; Playwright E2E tests cover them.
        "apps/desktop/src/main/index.ts",
        // Native message boxes and file dialogs only; recovery.ts holds the tested flow.
        "apps/desktop/src/main/recovery-dialogs.ts",
        // Electron wiring of the crash reports; crash-reports.ts and crash-handlers.ts are tested.
        "apps/desktop/src/main/crash-wiring.ts",
        "apps/desktop/src/preload/index.ts",
        "apps/desktop/src/renderer/main.tsx",
        "apps/desktop/src/worker/export-worker.ts",
        // Exists only in the electron-vite bundle (?base64 imports); the app E2E export covers it.
        "apps/desktop/src/worker/bundled-resources.ts",
      ],
      reporter: ["text-summary", "html", "lcov"],
      // One threshold set per workspace, so every package meets its floor on its own.
      thresholds: Object.fromEntries(
        workspaces.map((ws) => [`${ws.path}/src/**`, CORE_PACKAGES.has(ws.name) ? CORE : DEFAULT]),
      ),
    },
  },
});
