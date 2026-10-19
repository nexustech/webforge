import { readdirSync } from "node:fs";
import { defineConfig } from "vitest/config";

type Thresholds = { lines: number; branches: number; functions: number; statements: number };

/** Core logic is held to a higher bar (engineering standards §5). */
const CORE_PACKAGES = new Set(["model", "history", "storage", "pipeline", "publish"]);
const CORE: Thresholds = { lines: 90, branches: 85, functions: 90, statements: 90 };
const DEFAULT: Thresholds = { lines: 80, branches: 80, functions: 80, statements: 80 };

const workspaces = ["apps", "packages"].flatMap((group) =>
  readdirSync(group, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ path: `${group}/${entry.name}`, name: entry.name })),
);

export default defineConfig({
  test: {
    projects: ["apps/*", "packages/*"],
    coverage: {
      provider: "v8",
      include: workspaces.map((ws) => `${ws.path}/src/**/*.{ts,tsx}`),
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
        // Process entry points only wire tested modules together; Playwright E2E tests cover them.
        "apps/desktop/src/main/index.ts",
        "apps/desktop/src/preload/index.ts",
        "apps/desktop/src/renderer/main.tsx",
      ],
      reporter: ["text-summary", "html", "lcov"],
      // One threshold set per workspace, so every package meets its floor on its own.
      thresholds: Object.fromEntries(
        workspaces.map((ws) => [`${ws.path}/src/**`, CORE_PACKAGES.has(ws.name) ? CORE : DEFAULT]),
      ),
    },
  },
});
