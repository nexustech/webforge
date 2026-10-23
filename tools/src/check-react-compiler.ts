// React Compiler guard (ADR 0010, standards §2a): every component and hook must compile.
//
// Usage (see the root "react-compiler" script):
//   node tools/src/check-react-compiler.ts <folder>...
//
// Runs the compiler, as the app's and the Storybooks' builds do, over the .ts and .tsx files under
// the given folders (tests skipped) and fails on anything it reports: a function it can't compile
// (which the build would quietly leave unmemoized), a crash in the compiler, or a "use no memo"
// that turns it off. Biome has no rule for the compiler, so this check stands in for one.
//
// This file has no relative imports so Node can run it directly with type stripping.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { transformSync } from "@babel/core";
import reactCompiler, { type LoggerEvent } from "babel-plugin-react-compiler";

/** Something the compiler reported about a function. */
export type CompilerProblem = {
  readonly file: string;
  readonly line: number;
  readonly reason: string;
};

/** The line a compiler event is about: where it points, else the function it is in. */
function lineOf(event: LoggerEvent): number {
  if (event.kind === "CompileError") {
    const at = event.detail.primaryLocation();
    if (typeof at === "object" && at !== null) return at.start.line;
  }
  return "fnLoc" in event ? (event.fnLoc?.start.line ?? 0) : 0;
}

/** What went wrong, in a line, for an event that is a problem; undefined for any other. */
function reasonOf(event: LoggerEvent): string | undefined {
  switch (event.kind) {
    case "CompileError":
      return event.detail.description
        ? `${event.detail.reason}. ${event.detail.description}`
        : event.detail.reason;
    case "CompileDiagnostic":
      return event.detail.reason;
    case "CompileSkip":
      // The compiler's own message names the directive as "[object Object]".
      return /directive/i.test(event.reason)
        ? 'Turned off with a directive such as "use no memo"'
        : `Skipped: ${event.reason}`;
    case "PipelineError":
      return `Compiler crashed: ${event.data}`;
    default:
      return undefined;
  }
}

/** The problem a compiler event in `file` reports, if it is one (not a success or a timing). */
export function problemOf(file: string, event: LoggerEvent): CompilerProblem | undefined {
  const reason = reasonOf(event);
  return reason === undefined ? undefined : { file, line: lineOf(event), reason };
}

/** Compiles one source file and returns what the compiler reported. `file` is for reporting. */
export function findCompilerProblems(source: string, file: string): CompilerProblem[] {
  const problems: CompilerProblem[] = [];
  transformSync(source, {
    filename: file,
    babelrc: false,
    configFile: false,
    code: false,
    parserOpts: { plugins: file.endsWith(".tsx") ? ["typescript", "jsx"] : ["typescript"] },
    plugins: [
      [
        reactCompiler,
        {
          // Keep going after a problem, so every one in the file is reported.
          panicThreshold: "none",
          logger: {
            logEvent: (_filename: string | null, event: LoggerEvent) => {
              const problem = problemOf(file, event);
              if (problem !== undefined) problems.push(problem);
            },
          },
        },
      ],
    ],
  });
  return problems.toSorted((a, b) => a.line - b.line);
}

/** Whether a file is checked: sources and stories, which Storybook compiles too; not tests. */
export function isCheckedFile(path: string): boolean {
  return /\.tsx?$/.test(path) && !/\.(test|d)\.tsx?$/.test(path);
}

/** Every checked file under `folder`, recursively, skipping `node_modules`. */
export function listCheckedFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && isCheckedFile(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !path.split(/[\\/]/).includes("node_modules"))
    .toSorted();
}

/** Checks every file under `folders`. Paths in the result are relative to `root`. */
export function checkFolders(folders: readonly string[], root: string): CompilerProblem[] {
  return folders.flatMap((folder) =>
    listCheckedFiles(folder).flatMap((path) =>
      findCompilerProblems(readFileSync(path, "utf8"), relative(root, path).replaceAll("\\", "/")),
    ),
  );
}

/** One line per problem, for the terminal. */
export function formatCompilerProblems(problems: readonly CompilerProblem[]): string {
  return [
    `The React Compiler reported ${problems.length} problem(s). Fix the code, don't opt out (ADR 0010):`,
    ...problems.map((problem) => `  ${problem.file}:${problem.line}  ${problem.reason}`),
  ].join("\n");
}

/** Checks `folders` (relative to `root`), telling the terminal; returns the exit code. */
export function runCheck(folders: readonly string[], root: string): number {
  if (folders.length === 0) {
    console.error("Usage: node tools/src/check-react-compiler.ts <folder>...");
    return 2;
  }
  const problems = checkFolders(folders, root);
  if (problems.length > 0) {
    console.error(formatCompilerProblems(problems));
    return 1;
  }
  console.log(`The React Compiler compiles everything in ${folders.join(", ")}.`);
  return 0;
}

if (import.meta.main) {
  process.exitCode = runCheck(process.argv.slice(2), process.cwd());
}
