// The quick check (#1472): the static checks `pnpm check` runs, then only the unit tests the
// branch's changes can affect, on source, without coverage. The React Compiler's pass over the
// same tests (`pnpm test:compiled`) is left to CI and `pnpm check`: it doubles the time of any
// change to the editor, and what only compiled code does is rare (ADR 0010).
//
// Usage (the root "check:quick" script, before a PR and after each fix):
//   node tools/src/check-quick.ts
//
// Run from the repository root. Which tests run:
// - those Vitest finds through the module graph from each file changed since the branch left
//   `main` (committed, staged, unstaged and untracked): `related`, as `vitest --changed` does.
//   It follows imports across the workspace packages, `?raw` imports and `import.meta.glob`, and
//   runs everything when a Vitest config, or a file one imports, changes;
// - every test of a workspace (an app, a package or tools) where a file that isn't a code module
//   changed, such as a template's JSON, a fixture or an image, which tests read from disk;
// - the tests that read the repository's files or run a child process, found by reading the test
//   files ({@link readsFromDisk}), as those reach files no import names: those of the workspaces
//   the change touches, and all of them when a data file changed.
// It runs every test, on source and compiled code but still without coverage, when a change reaches what no import graph shows:
// dependencies, a patch to one, the workspace or a TypeScript config ({@link RUN_ALL_TRIGGERS}).
// CI runs everything, with coverage, on every ready PR; `pnpm check` does the same here.
//
// This file has no relative imports so Node can run it directly with type stripping.

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { createVitest as CreateVitest, TestSpecification, Vitest } from "vitest/node";

/** A file a change can reach that no module imports, so every test runs, and why. */
export const RUN_ALL_TRIGGERS: readonly { readonly match: RegExp; readonly why: string }[] = [
  { match: /(^|\/)package\.json$/, why: "a package.json changed (dependencies or scripts)" },
  { match: /^pnpm-(lock|workspace)\.yaml$/, why: "the workspace or its lockfile changed" },
  { match: /^\.npmrc$/, why: "pnpm's settings changed" },
  { match: /^patches\//, why: "a patch to a dependency changed" },
  { match: /(^|\/)tsconfig[^/]*\.json$/, why: "a TypeScript config changed" },
];

/** A file Vitest loads as a module, whose importers it can find. */
const CODE_MODULE = /\.[cm]?[jt]sx?$/;

/** What the tests of a change are: every test, and why, or those it reaches. */
export type QuickPlan =
  | { readonly kind: "all"; readonly why: string; readonly file: string }
  | {
      readonly kind: "related";
      /** Workspaces where a file that isn't a code module changed: all their tests run. */
      readonly dataWorkspaces: readonly string[];
      /** Every workspace a changed file is in: their disk-reading tests run. */
      readonly touched: readonly string[];
    };

/**
 * Which tests `changed` (paths from the repository root, with forward slashes) needs, given the
 * `workspaces` (`apps/desktop`, `packages/model`, `tools`…).
 */
export function planQuickCheck(
  changed: readonly string[],
  workspaces: readonly string[],
): QuickPlan {
  for (const file of changed) {
    const trigger = RUN_ALL_TRIGGERS.find(({ match }) => match.test(file));
    if (trigger !== undefined) return { kind: "all", why: trigger.why, file };
  }
  const data = new Set<string>();
  const touched = new Set<string>();
  for (const file of changed) {
    const workspace = workspaceOf(file, workspaces);
    if (workspace === undefined) continue;
    touched.add(workspace);
    if (!CODE_MODULE.test(file)) data.add(workspace);
  }
  return {
    kind: "related",
    dataWorkspaces: [...data].toSorted(),
    touched: [...touched].toSorted(),
  };
}

/** The workspace `file` is in, if any. */
export function workspaceOf(file: string, workspaces: readonly string[]): string | undefined {
  return workspaces.find((ws) => file.startsWith(`${ws}/`));
}

/**
 * Whether a test's source reads files or runs a process: what it reaches then isn't in its
 * imports, so a change to it can't be traced to the test.
 */
export function readsFromDisk(source: string): boolean {
  return /\b(?:readFileSync|readdirSync|readFile|readdir|globSync|existsSync|statSync|spawn|spawnSync|execFile|execFileSync|execSync|fork)\s*\(|import\.meta\.(?:glob|dirname|url)\b|\bfileURLToPath\b|\btoMatchFileSnapshot\b|\bread[A-Z]\w*\(/.test(
    source,
  );
}

/** The paths in git's NUL-separated output (`-z`), with forward slashes. */
export function nulSeparated(output: string): string[] {
  return output
    .split("\0")
    .filter((path) => path !== "")
    .map((path) => path.replaceAll("\\", "/"));
}

/** The workspaces under `root`: each folder in apps and packages, and tools. */
export function workspacesIn(root: string): string[] {
  return [
    ...["apps", "packages"].flatMap((group) =>
      readdirSync(join(root, group), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => `${group}/${entry.name}`),
    ),
    "tools",
  ];
}

/** Test files under `root`'s workspaces, from the repository root, skipping node_modules. */
export function testFilesIn(root: string, workspaces: readonly string[]): string[] {
  const found: string[] = [];
  const walk = (folder: string): void => {
    for (const entry of readdirSync(join(root, folder), { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const path = `${folder}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (/\.test\.[cm]?[jt]sx?$/.test(entry.name)) found.push(path);
    }
  };
  for (const workspace of workspaces) walk(workspace);
  return found.toSorted();
}

/** What runs a step and says how it went: true when it passed. */
export type Steps = {
  /** The changed files since the branch left `main`, from the repository root. */
  readonly changed: () => string[];
  /** `pnpm check:static`. */
  readonly staticChecks: () => boolean;
  /** One Vitest config's tests: every one, or those related to `changed` plus `extra` filters. */
  readonly tests: (
    config: string,
    selection: { readonly all: true } | { readonly related: string[]; readonly extra: string[] },
  ) => Promise<boolean>;
  readonly workspaces: () => string[];
  readonly diskReadingTests: () => string[];
  readonly log: (line: string) => void;
  readonly now: () => number;
};

/** The Vitest configs: on source, then on compiled code (`test:compiled`), which only a change
 * that runs every test runs here. */
export const CONFIGS = ["vitest.config.ts", "vitest.compiled.config.ts"] as const;

/** Runs the quick check with `steps`, logs what it did and didn't check: true when it passed. */
export async function runQuickCheck(steps: Steps): Promise<boolean> {
  const times: string[] = [];
  const timed = async (name: string, step: () => boolean | Promise<boolean>) => {
    const start = steps.now();
    const passed = await step();
    times.push(`${name} ${Math.round((steps.now() - start) / 1000)} s`);
    steps.log(`[quick] ${times.at(-1)}${passed ? "" : ", failed"}.`);
    return passed;
  };
  const changed = steps.changed();
  const plan = planQuickCheck(changed, steps.workspaces());
  steps.log(`[quick] ${changed.length} file(s) changed since the branch left main.`);
  if (plan.kind === "all") steps.log(`[quick] Every test runs: ${plan.why} (${plan.file}).`);
  else if (plan.dataWorkspaces.length > 0) {
    steps.log(
      `[quick] Every test of ${plan.dataWorkspaces.join(", ")} runs, and every disk-reading test: a data file changed.`,
    );
  }

  let passed = await timed("static checks", steps.staticChecks);
  if (passed) {
    const extra = (() => {
      if (plan.kind === "all") return [];
      const workspaces = steps.workspaces();
      const disk = steps.diskReadingTests().filter((file) => {
        if (plan.dataWorkspaces.length > 0) return true;
        const workspace = workspaceOf(file, workspaces);
        return workspace !== undefined && plan.touched.includes(workspace);
      });
      return [...plan.dataWorkspaces.map((ws) => `${ws}/`), ...disk];
    })();
    for (const config of plan.kind === "all" ? CONFIGS : CONFIGS.slice(0, 1)) {
      const selection = plan.kind === "all" ? { all: true as const } : { related: changed, extra };
      passed = await timed(`tests (${config})`, () => steps.tests(config, selection));
      if (!passed) break;
    }
  }
  steps.log(`[quick] ${passed ? "Passed" : "Failed"}: ${times.join(", ")}.`);
  steps.log(
    "[quick] Not checked here: coverage limits, the React Compiler's pass, tests the change " +
      "can't reach, and Windows-only failures in those. CI checks them on every ready PR; " +
      "`pnpm check` checks them here.",
  );
  return passed;
}

/** The files changed since HEAD left `origin/main` (or `main`), from `root`. */
export function changedSinceMain(root: string): string[] {
  const git = (...args: string[]) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
    return result.stdout;
  };
  const base = (() => {
    for (const ref of ["origin/main", "main"]) {
      const result = spawnSync("git", ["merge-base", "HEAD", ref], { cwd: root, encoding: "utf8" });
      if (result.status === 0) return result.stdout.trim();
    }
    throw new Error("No main or origin/main to compare with");
  })();
  return [
    ...new Set([
      ...nulSeparated(git("diff", "--name-only", "-z", "--no-renames", base)),
      ...nulSeparated(git("ls-files", "--others", "--exclude-standard", "-z")),
    ]),
  ].toSorted();
}

/** What starts Vitest for a run: its Node API's `createVitest`, in test mode. */
export type StartVitest = (
  options: NonNullable<Parameters<typeof CreateVitest>[1]>,
) => Promise<Vitest>;

/** Vitest's own, loaded when first used. */
const startVitest: StartVitest = async (options) =>
  (await import("vitest/node")).createVitest("test", options);

/**
 * Runs one config's tests through Vitest's API (`start`), without coverage: true when they passed.
 * `log` says how many test files it runs.
 */
export async function vitestRun(
  root: string,
  config: string,
  selection: Parameters<Steps["tests"]>[1],
  start: StartVitest = startVitest,
  log: (line: string) => void = console.log,
): Promise<boolean> {
  const related =
    "related" in selection ? selection.related.map((file) => resolve(root, file)) : [];
  const vitest = await start({
    root,
    config: resolve(root, config),
    watch: false,
    passWithNoTests: true,
    coverage: { enabled: false },
    // test:compiled's own limit: the compiler makes each worker costlier.
    ...(config === "vitest.compiled.config.ts" ? { maxWorkers: "50%" } : {}),
    ...(related.length > 0 ? { related } : {}),
  });
  try {
    let specifications: TestSpecification[];
    if ("all" in selection) specifications = await vitest.globTestSpecifications();
    else {
      const byGraph = related.length > 0 ? await vitest.getRelevantTestSpecifications() : [];
      const byFilter =
        selection.extra.length > 0
          ? await vitest.globTestSpecifications(selection.extra.map((path) => resolve(root, path)))
          : [];
      const seen = new Set<string>();
      specifications = [...byGraph, ...byFilter].filter((spec) => {
        const key = `${spec.project.name}\0${spec.moduleId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    if (specifications.length === 0) {
      log(`[quick] ${config}: no test reaches the change.`);
      return true;
    }
    log(`[quick] ${config}: ${specifications.length} test file(s).`);
    // The reporters, which only a run Vitest starts itself would set up.
    await vitest.standalone();
    const result = await vitest.runTestSpecifications(specifications);
    return result.unhandledErrors.length === 0 && result.testModules.every((module) => module.ok());
  } finally {
    await vitest.close();
  }
}

/**
 * Runs the quick check in `root`, the repository; sets a failing exit code if it fails. `files`,
 * when given (`node tools/src/check-quick.ts <file>…`), stand for the changed files.
 */
export async function main(root = process.cwd(), files: readonly string[] = []): Promise<void> {
  const workspaces = workspacesIn(root);
  const passed = await runQuickCheck({
    changed: () => (files.length > 0 ? nulSeparated(files.join("\0")) : changedSinceMain(root)),
    staticChecks: () =>
      // One command line, with the shell that finds pnpm's shim on Windows.
      spawnSync("pnpm run check:static", { cwd: root, stdio: "inherit", shell: true }).status === 0,
    tests: (config, selection) => vitestRun(root, config, selection),
    workspaces: () => workspaces,
    diskReadingTests: () =>
      testFilesIn(root, workspaces).filter((file) =>
        readsFromDisk(readFileSync(join(root, file), "utf8")),
      ),
    log: (line) => console.log(line),
    now: () => performance.now(),
  });
  if (!passed) process.exitCode = 1;
}

if (import.meta.main) {
  await main(process.cwd(), process.argv.slice(2));
}
