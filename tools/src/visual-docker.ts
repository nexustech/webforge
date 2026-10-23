// Runs `pnpm visual` with screenshots inside CI's pinned Playwright Linux container, so a PR can
// commit its new or changed story screenshots before CI runs, instead of failing CI first and
// pushing the `visual-screenshots` artifact afterwards.
//
// Usage (the "visual:docker" script in the root package.json; Docker must be running):
//   pnpm visual:docker                 compare, and write screenshots for new stories (as CI does)
//   pnpm visual:docker --update        also rewrite screenshots that changed; review them with git diff
//   pnpm visual:docker -- --grep Picker   pass anything after -- to Playwright
//
// The working tree as git sees it (tracked files and new unignored ones, uncommitted changes
// included) is copied into the container, installed there and built as CI's Storybook job does. Only the screenshots, and the
// Playwright report when something fails, are copied back. Downloads (Node, pnpm and the pnpm store)
// are cached in the Docker volume "webforge-visual-cache".
//
// This file has no relative imports so Node can run it directly with type stripping.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const CACHE_VOLUME = "webforge-visual-cache";

export type VisualDockerOptions = {
  /** Rewrite screenshots that no longer match, not only the missing ones. */
  readonly update: boolean;
  /** Extra Playwright arguments (after `--`). */
  readonly playwrightArgs: readonly string[];
};

/** Reads `--update` and anything after `--` from the command line. */
export function parseArgs(argv: readonly string[]): VisualDockerOptions {
  const dashes = argv.indexOf("--");
  const own = dashes === -1 ? argv : argv.slice(0, dashes);
  const playwrightArgs = dashes === -1 ? [] : argv.slice(dashes + 1);
  const unknown = own.filter((arg) => arg !== "--update");
  if (unknown.length > 0) {
    throw new Error(
      `Unknown option ${unknown.join(" ")}. Use --update, or pass Playwright options after --.`,
    );
  }
  return { update: own.includes("--update"), playwrightArgs };
}

/** CI's Storybook container: the Playwright image of the version e2e/package.json pins. */
export function playwrightImage(e2ePackageJson: string): string {
  const pkg = JSON.parse(e2ePackageJson) as { devDependencies?: Record<string, string> };
  const version = pkg.devDependencies?.["@playwright/test"];
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(
      `e2e/package.json must pin @playwright/test to an exact version, not ${version}`,
    );
  }
  return `mcr.microsoft.com/playwright:v${version}-noble`;
}

/** Quotes one argument for the container's bash. */
function shellQuote(arg: string): string {
  return `'${arg.replaceAll("'", "'\\''")}'`;
}

/** The bash script the container runs: CI's Storybook job, on a copy of /src. */
export function containerScript(options: VisualDockerOptions): string {
  const update = options.update ? "changed" : "missing";
  const extra = options.playwrightArgs.map(shellQuote).join(" ");
  return [
    "set -euo pipefail",
    "export CI=1 VISUAL_SCREENSHOTS=1 STORYBOOK_DISABLE_TELEMETRY=1 ELECTRON_SKIP_BINARY_DOWNLOAD=1",
    "export COREPACK_HOME=/cache/corepack COREPACK_ENABLE_DOWNLOAD_PROMPT=0",
    // The Node major in .nvmrc, as CI's setup-node installs it.
    'want=$(tr -d "[:space:]v" < /src/.nvmrc)',
    'if [ "$(node -p "process.versions.node.split(\'.\')[0]")" != "$want" ]; then',
    "  node_dir=/cache/node-$want",
    '  if [ ! -x "$node_dir/bin/node" ]; then',
    '    echo "Downloading Node $want"',
    '    base="https://nodejs.org/dist/latest-v$want.x"',
    '    sums=$(curl -fsSL "$base/SHASUMS256.txt")',
    // .tar.gz, as the image has no xz; checked against Node's published checksum before unpacking.
    '    line=$(grep -E "  node-v[0-9.]+-linux-x64\\.tar\\.gz$" <<< "$sums" | head -1)',
    "    sum=$(awk '{print $1}' <<< \"$line\") file=$(awk '{print $2}' <<< \"$line\")",
    '    curl -fsSL -o /tmp/node.tar.gz "$base/$file"',
    '    sha256sum -c <<< "$sum  /tmp/node.tar.gz"',
    '    mkdir -p "$node_dir"',
    '    tar -xz -C "$node_dir" --strip-components=1 -f /tmp/node.tar.gz',
    "  fi",
    '  export PATH="$node_dir/bin:$PATH"',
    "fi",
    "corepack enable pnpm",
    // A fresh copy of what git sees: tracked files and new ones that aren't ignored, so build
    // output, node_modules and the streams' worktrees (.claude/worktrees) stay out. Files deleted
    // in the working tree are still in the index; --ignore-failed-read skips them.
    "rm -rf /work && mkdir /work",
    "git config --global --add safe.directory /src",
    "git -C /src ls-files -z --cached --others --exclude-standard |" +
      " tar -C /src --null --ignore-failed-read -T - -cf - | tar -C /work -xf -",
    "cd /work",
    // lefthook's install script expects a git repository.
    "git init -q",
    "pnpm install --frozen-lockfile --store-dir /cache/pnpm-store",
    "pnpm --filter @webforge/editor-ui --filter @webforge/site-components build-storybook",
    "status=0",
    `pnpm --filter @webforge/e2e e2e:visual --update-snapshots=${update} ${extra} || status=$?`,
    "cp -r /work/e2e/visual/__screenshots__/. /src/e2e/visual/__screenshots__/",
    'if [ "$status" -ne 0 ]; then',
    "  rm -rf /src/e2e/test-results /src/e2e/playwright-report",
    "  cp -r /work/e2e/test-results /work/e2e/playwright-report /src/e2e/ 2>/dev/null || true",
    "fi",
    'exit "$status"',
  ].join("\n");
}

/** `docker run` arguments: the repository mounted at /src, and the cache volume at /cache. */
export function dockerArgs(repo: string, image: string, options: VisualDockerOptions): string[] {
  return [
    "run",
    "--rm",
    "--init",
    // Chromium in Docker needs more shared memory than the default.
    "--ipc=host",
    "-v",
    `${repo}:/src`,
    "-v",
    `${CACHE_VOLUME}:/cache`,
    image,
    "bash",
    "-c",
    containerScript(options),
  ];
}

if (import.meta.main) {
  const repo = resolve(import.meta.dirname, "../..");
  try {
    const options = parseArgs(process.argv.slice(2));
    const image = playwrightImage(readFileSync(join(repo, "e2e/package.json"), "utf8"));
    const docker = spawnSync("docker", ["info"], { stdio: "ignore" });
    if (docker.status !== 0) {
      console.error("Docker isn't running. Start Docker Desktop and try again.");
      process.exit(1);
    }
    const run = spawnSync("docker", dockerArgs(repo, image, options), { stdio: "inherit" });
    if (run.status === 0) {
      console.log("Done. Commit any new or changed files in e2e/visual/__screenshots__/.");
    } else {
      console.error("Some stories failed: see e2e/playwright-report/ (and e2e/test-results/).");
    }
    process.exit(run.status ?? 1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
