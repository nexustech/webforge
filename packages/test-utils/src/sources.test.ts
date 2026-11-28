import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isTestOrStory, sourcesMatching } from "./sources.js";

const folders: string[] = [];

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/** A git repository of `files` by path, `committed` added and committed, the rest left untracked. */
function repository(files: Record<string, string>, committed: readonly string[]): string {
  const root = mkdtempSync(join(tmpdir(), "webforge-sources-"));
  folders.push(root);
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], {
      cwd: root,
    });
  git("init", "-q");
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  if (committed.length > 0) {
    git("add", ...committed);
    git("commit", "-q", "-m", "files");
  }
  return root;
}

describe("sourcesMatching (#1566, #1569)", () => {
  it("finds the files with a matching line, tracked or not yet, with their text, and not ignored ones", () => {
    const root = repository(
      {
        "a/kept.ts": 'export const kind = "claude";\n',
        "a/new.tsx": 'const kind = "claude";\n',
        "a/other.ts": 'export const kind = "vscode";\n',
        "built/out.ts": 'const kind = "claude";\n',
        ".gitignore": "built/\n",
      },
      ["a/kept.ts", "a/other.ts", ".gitignore"],
    );

    expect(sourcesMatching(root, '"claude"', ["*.ts", "*.tsx"], { fixed: true })).toEqual([
      { path: "a/kept.ts", text: 'export const kind = "claude";\n' },
      { path: "a/new.tsx", text: 'const kind = "claude";\n' },
    ]);
  });

  it("takes an extended regular expression, and finds none where nothing matches", () => {
    // Not a test's call, which the check of this package's timeouts would take it for.
    const root = repository({ "x.ts": "wait('a', 15_000);\n" }, []);
    expect(
      sourcesMatching(root, ",[[:space:]]*[0-9_]+\\)", ["*.ts"]).map((file) => file.path),
    ).toEqual(["x.ts"]);
    expect(sourcesMatching(root, "nothing like it", ["*.ts"])).toEqual([]);
  });

  it("tells tests and stories from the app's own code", () => {
    expect(isTestOrStory("renderer/a.test.tsx")).toBe(true);
    expect(isTestOrStory("renderer/a.stories.tsx")).toBe(true);
    expect(isTestOrStory("renderer/a.tsx")).toBe(false);
  });
});
