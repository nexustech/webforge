import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** A source file: its path under the folder it was searched from, with "/" between parts, and its text. */
export type SourceFile = { readonly path: string; readonly text: string };

/**
 * The files under `root` that `pathspecs` (git's, relative to `root`) name and that have a line
 * matching `pattern`, with their text, for the tests that scan a package's source (#1566, #1569).
 *
 * `git grep` finds them, in one call, among the files git tracks and those it doesn't yet (not
 * those it ignores), so a test reads only the few that can matter. Reading every file with
 * `readFileSync`, one after another, ran past the tests' time limit on a machine busy with the
 * rest of the run. `pattern` is an extended regular expression, or plain text with `fixed`. It
 * matches one line at a time, so a test checks across lines itself.
 */
export function sourcesMatching(
  root: string,
  pattern: string,
  pathspecs: readonly string[],
  { fixed = false }: { readonly fixed?: boolean } = {},
): SourceFile[] {
  let found: string;
  try {
    found = execFileSync(
      "git",
      ["grep", "-l", "-z", "--untracked", fixed ? "-F" : "-E", "-e", pattern, "--", ...pathspecs],
      { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
  } catch (error) {
    // No file matched: `git grep` exits with 1 and prints nothing.
    if ((error as { status?: unknown }).status === 1) return [];
    throw error;
  }
  return found
    .split("\0")
    .filter((path) => path !== "")
    .toSorted()
    .map((path) => ({ path, text: readFileSync(join(root, path), "utf8") }));
}

/** Whether `path` is a test or a story, which the scans of the app's own code leave out. */
export const isTestOrStory = (path: string): boolean => /\.(test|stories)\.tsx?$/.test(path);
