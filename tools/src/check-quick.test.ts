import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { TEST_DIR_REMOVAL } from "@webforge/test-utils/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TestSpecification, Vitest } from "vitest/node";
import {
  CONFIGS,
  changedSinceMain,
  nulSeparated,
  planQuickCheck,
  readsFromDisk,
  runQuickCheck,
  type StartVitest,
  type Steps,
  testFilesIn,
  vitestRun,
  workspacesIn,
} from "./check-quick.js";

const WORKSPACES = ["apps/desktop", "packages/model", "packages/templates", "tools"];

describe("planQuickCheck (#1472)", () => {
  it.each([
    ["package.json"],
    ["packages/model/package.json"],
    ["pnpm-lock.yaml"],
    ["pnpm-workspace.yaml"],
    [".npmrc"],
    ["patches/@puckeditor__core@0.24.0.patch"],
    ["tsconfig.base.json"],
    ["apps/desktop/tsconfig.web.json"],
  ])("runs every test when %s changes", (file) => {
    const plan = planQuickCheck(["packages/model/src/site.ts", file], WORKSPACES);
    expect(plan).toMatchObject({ kind: "all", file });
  });

  it("runs the related tests only for code modules, wherever they are", () => {
    expect(
      planQuickCheck(
        ["packages/model/src/site.ts", "apps/desktop/src/renderer/x.tsx", "vitest.load.ts"],
        WORKSPACES,
      ),
    ).toEqual({
      kind: "related",
      dataWorkspaces: [],
      touched: ["apps/desktop", "packages/model"],
    });
  });

  it("runs all of a workspace's tests where a file that isn't a code module changed", () => {
    expect(
      planQuickCheck(
        [
          "packages/templates/templates/cafe/template.json",
          "tools/biome/no-branded-id-cast.grit",
          "packages/templates/templates/trades/template.json",
        ],
        WORKSPACES,
      ),
    ).toEqual({
      kind: "related",
      dataWorkspaces: ["packages/templates", "tools"],
      touched: ["packages/templates", "tools"],
    });
  });

  it("leaves a file outside the workspaces to the module graph (docs/help reached by ?raw)", () => {
    expect(planQuickCheck(["docs/help/add-panel.md", "CLAUDE.md"], WORKSPACES)).toEqual({
      kind: "related",
      dataWorkspaces: [],
      touched: [],
    });
  });

  it("doesn't take a workspace for another whose name it starts", () => {
    expect(planQuickCheck(["packages/modeling/data.json"], WORKSPACES)).toEqual({
      kind: "related",
      dataWorkspaces: [],
      touched: [],
    });
  });
});

describe("readsFromDisk (#1472)", () => {
  it.each([
    ['readFileSync(join(root, "x"))'],
    ["await readFile(path)"],
    ["readdirSync(dir)"],
    ["existsSync(file)"],
    ['spawnSync("node", ["x"])'],
    ["execFile(biome)"],
    ["const here = import.meta.dirname;"],
    ['import.meta.glob("./*.md")'],
    ["fileURLToPath(import.meta.url)"],
    ['await expect(html).toMatchFileSnapshot("./golden/x.html")'],
    ['const template = readTemplate("cafe")'],
  ])("finds a test that reaches files: %s", (source) => {
    expect(readsFromDisk(source)).toBe(true);
  });

  it("leaves a test that only imports what it tests", () => {
    expect(
      readsFromDisk('import { siteOf } from "./site.js";\nexpect(siteOf(read)).toEqual(thread);'),
    ).toBe(false);
  });
});

describe("nulSeparated", () => {
  it("splits git's -z output, keeping spaces, with forward slashes", () => {
    expect(nulSeparated("a b/c.ts\0docs\\x.md\0\0")).toEqual(["a b/c.ts", "docs/x.md"]);
  });
});

describe("workspaces and their tests", () => {
  const made: string[] = [];
  afterEach(() => {
    for (const dir of made.splice(0)) rmSync(dir, TEST_DIR_REMOVAL);
  });

  it("finds each app and package, tools, and their test files outside node_modules", () => {
    const root = mkdtempSync(join(tmpdir(), "webforge-quick-"));
    made.push(root);
    for (const [path, text] of [
      ["apps/desktop/src/a.test.ts", ""],
      ["apps/desktop/src/b.ts", ""],
      ["packages/model/test/c.test.tsx", ""],
      ["packages/model/node_modules/x/d.test.ts", ""],
      ["packages/model/.cache/e.test.ts", ""],
      ["tools/src/f.test.ts", ""],
      ["packages/readme.md", ""],
    ] as const) {
      mkdirSync(join(root, path, ".."), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    const workspaces = workspacesIn(root);
    expect(workspaces).toEqual(["apps/desktop", "packages/model", "tools"]);
    expect(testFilesIn(root, workspaces)).toEqual([
      "apps/desktop/src/a.test.ts",
      "packages/model/test/c.test.tsx",
      "tools/src/f.test.ts",
    ]);
  });
});

describe("runQuickCheck (#1472)", () => {
  type Call = { config: string; selection: Parameters<Steps["tests"]>[1] };

  function steps(changed: string[], outcome: { static?: boolean; tests?: boolean } = {}) {
    const calls: Call[] = [];
    const lines: string[] = [];
    let clock = 0;
    const run: Steps = {
      changed: () => changed,
      staticChecks: () => outcome.static ?? true,
      tests: async (config, selection) => {
        calls.push({ config, selection });
        return outcome.tests ?? true;
      },
      workspaces: () => WORKSPACES,
      diskReadingTests: () => ["tools/src/x.test.ts", "apps/desktop/src/main/y.test.ts"],
      log: (line) => lines.push(line),
      now: () => (clock += 1000),
    };
    return { run, calls, lines };
  }

  it("runs the related tests and the touched workspaces' disk-reading ones, on source only", async () => {
    const { run, calls, lines } = steps(["apps/desktop/src/renderer/a.tsx", "docs/help/x.md"]);
    expect(await runQuickCheck(run)).toBe(true);
    expect(calls).toEqual([
      {
        config: CONFIGS[0],
        selection: {
          related: ["apps/desktop/src/renderer/a.tsx", "docs/help/x.md"],
          extra: ["apps/desktop/src/main/y.test.ts"],
        },
      },
    ]);
    expect(lines.join("\n")).toContain("Passed: static checks 1 s");
    expect(lines.at(-1)).toContain("Not checked here: coverage limits, the React Compiler's pass");
  });

  it("runs a data workspace's tests and every disk-reading test when a data file changed", async () => {
    const { run, calls, lines } = steps([
      "packages/model/src/site.ts",
      "packages/templates/templates/cafe/template.json",
    ]);
    expect(await runQuickCheck(run)).toBe(true);
    expect(calls.map((call) => call.config)).toEqual([CONFIGS[0]]);
    expect(calls[0]?.selection).toEqual({
      related: ["packages/model/src/site.ts", "packages/templates/templates/cafe/template.json"],
      extra: ["packages/templates/", "tools/src/x.test.ts", "apps/desktop/src/main/y.test.ts"],
    });
    expect(lines.join("\n")).toContain("Every test of packages/templates runs");
  });

  it("runs every test when a trigger changed, and says why", async () => {
    const { run, calls, lines } = steps(["pnpm-lock.yaml"]);
    expect(await runQuickCheck(run)).toBe(true);
    expect(calls.map((call) => call.selection)).toEqual([{ all: true }, { all: true }]);
    expect(lines.join("\n")).toContain("Every test runs: the workspace or its lockfile changed");
  });

  it("runs no tests when the static checks fail", async () => {
    const { run, calls, lines } = steps(["tools/src/a.ts"], { static: false });
    expect(await runQuickCheck(run)).toBe(false);
    expect(calls).toEqual([]);
    expect(lines.join("\n")).toContain("Failed: static checks");
  });

  it("stops after the first config whose tests fail", async () => {
    const { run, calls } = steps(["pnpm-lock.yaml"], { tests: false });
    expect(await runQuickCheck(run)).toBe(false);
    expect(calls).toHaveLength(1);
  });
});

describe("changedSinceMain (#1472)", () => {
  const made: string[] = [];
  afterEach(() => {
    for (const dir of made.splice(0)) rmSync(dir, TEST_DIR_REMOVAL);
  });

  /** Runs git in `root` as a test author, failing the test if it fails. */
  const git = (root: string, ...args: string[]) => {
    const result = spawnSync(
      "git",
      [
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.invalid",
        "-c",
        "core.hooksPath=",
        ...args,
      ],
      { cwd: root, encoding: "utf8" },
    );
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout;
  };

  /** A repository with one commit on `branch`. */
  function repository(branch: string): string {
    const root = mkdtempSync(join(tmpdir(), "webforge-quick-git-"));
    made.push(root);
    git(root, "init", "-q", "-b", branch);
    writeFileSync(join(root, "kept.ts"), "");
    writeFileSync(join(root, "moved.ts"), "");
    git(root, "add", ".");
    git(root, "commit", "-q", "-m", "first");
    return root;
  }

  it("lists what's committed, staged, unstaged and untracked since main, a move as both paths", () => {
    const root = repository("main");
    git(root, "switch", "-q", "-c", "work");
    writeFileSync(join(root, "committed.ts"), "");
    git(root, "add", "committed.ts");
    git(root, "mv", "moved.ts", "moved to.ts");
    git(root, "commit", "-q", "-m", "second");
    writeFileSync(join(root, "kept.ts"), "changed");
    writeFileSync(join(root, "staged.ts"), "");
    git(root, "add", "staged.ts");
    writeFileSync(join(root, "new file.ts"), "");

    expect(changedSinceMain(root)).toEqual([
      "committed.ts",
      "kept.ts",
      "moved to.ts",
      "moved.ts",
      "new file.ts",
      "staged.ts",
    ]);
  });

  it("says so when there's no main to compare with", () => {
    const root = repository("trunk");
    expect(() => changedSinceMain(root)).toThrow("No main or origin/main");
  });
});

describe("vitestRun (#1472)", () => {
  type Spec = Pick<TestSpecification, "moduleId"> & { project: { name: string } };
  const spec = (moduleId: string, project = "app") => ({ moduleId, project: { name: project } });

  /** A Vitest that finds `byGraph` and `byFilter` and whose run ends as `outcome` says. */
  function fakeVitest(
    byGraph: Spec[],
    byFilter: Spec[],
    outcome: { failed?: boolean; unhandled?: boolean } = {},
  ) {
    const calls = {
      options: [] as unknown[],
      globs: [] as (string[] | undefined)[],
      ran: [] as Spec[][],
      standalone: 0,
      closed: 0,
    };
    const vitest = {
      getRelevantTestSpecifications: async () => byGraph,
      globTestSpecifications: async (filters?: string[]) => {
        calls.globs.push(filters);
        return filters === undefined ? [...byGraph, ...byFilter] : byFilter;
      },
      standalone: async () => {
        calls.standalone += 1;
      },
      runTestSpecifications: async (specs: Spec[]) => {
        calls.ran.push(specs);
        return {
          testModules: specs.map(() => ({ ok: () => outcome.failed !== true })),
          unhandledErrors: outcome.unhandled === true ? [new Error("late")] : [],
        };
      },
      close: async () => {
        calls.closed += 1;
      },
    };
    const start: StartVitest = async (options) => {
      calls.options.push(options);
      return vitest as unknown as Vitest;
    };
    return { start, calls };
  }

  const root = resolve("/repo");

  it("runs the related tests and the filtered ones once each, without coverage", async () => {
    const { start, calls } = fakeVitest([spec("a"), spec("b")], [spec("b"), spec("b", "other")]);
    const log = vi.fn();
    const passed = await vitestRun(
      root,
      "vitest.config.ts",
      { related: ["x.ts"], extra: ["tools/"] },
      start,
      log,
    );

    expect(passed).toBe(true);
    expect(calls.options[0]).toMatchObject({
      related: [resolve(root, "x.ts")],
      coverage: { enabled: false },
      passWithNoTests: true,
    });
    expect(calls.options[0]).not.toHaveProperty("maxWorkers");
    expect(calls.globs).toEqual([[resolve(root, "tools/")]]);
    expect(calls.ran[0]?.map((each) => `${each.project.name}:${each.moduleId}`)).toEqual([
      "app:a",
      "app:b",
      "other:b",
    ]);
    expect(calls.standalone).toBe(1);
    expect(calls.closed).toBe(1);
    expect(log).toHaveBeenCalledWith("[quick] vitest.config.ts: 3 test file(s).");
  });

  it("runs every test of the compiled config at its own worker limit", async () => {
    const { start, calls } = fakeVitest([spec("a")], [spec("c")]);
    expect(await vitestRun(root, "vitest.compiled.config.ts", { all: true }, start, vi.fn())).toBe(
      true,
    );
    expect(calls.options[0]).toMatchObject({ maxWorkers: "50%" });
    expect(calls.options[0]).not.toHaveProperty("related");
    expect(calls.globs).toEqual([undefined]);
    expect(calls.ran[0]).toHaveLength(2);
  });

  it("passes without a run when no test reaches the change, and closes Vitest", async () => {
    const { start, calls } = fakeVitest([], []);
    const log = vi.fn();
    expect(await vitestRun(root, "vitest.config.ts", { related: [], extra: [] }, start, log)).toBe(
      true,
    );
    expect(calls.globs).toEqual([]);
    expect(calls.ran).toEqual([]);
    expect(calls.closed).toBe(1);
    expect(log).toHaveBeenCalledWith("[quick] vitest.config.ts: no test reaches the change.");
  });

  it.each([
    ["a test fails", { failed: true }],
    ["an error comes after the tests", { unhandled: true }],
  ])("fails when %s", async (_, outcome) => {
    const { start, calls } = fakeVitest([spec("a")], [], outcome);
    expect(
      await vitestRun(root, "vitest.config.ts", { related: ["a.ts"], extra: [] }, start, vi.fn()),
    ).toBe(false);
    expect(calls.closed).toBe(1);
  });
});
