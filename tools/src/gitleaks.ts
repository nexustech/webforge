// Gitleaks before every push (5.24, OL-13).
//
// Usage:
//   node tools/src/gitleaks.ts            lefthook's pre-push hook: git's refs being pushed on stdin
//   node tools/src/gitleaks.ts --history  every commit in the repository (`pnpm secrets-check`)
//
// GitHub's push protection only knows providers' tokens: its patterns for passwords and private
// keys need paid Secret Protection. So this hook scans the commits being pushed with Gitleaks, and
// stops the push when one holds what looks like a secret, naming the file and line. Values the
// repository holds on purpose (test keys, the security reviews' samples) are allowed in
// `.gitleaks.toml`, each with a reason.
//
// Gitleaks (MIT) is a Go binary, not an npm package: the first push downloads the release pinned
// here from GitHub and checks it against its SHA-256 before it ever runs. It's kept in the git
// directory (`.git/gitleaks/<version>/`), so every worktree of a clone shares one copy. If it can't
// be downloaded, or doesn't match, the push stops and says why: the hook is never skipped quietly.
//
// This file has no relative imports so Node can run it directly with type stripping.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

/** The pinned release: a new one changes the version and every checksum below together. */
export const GITLEAKS_VERSION = "8.30.1";

/** Each build's archive and its SHA-256, from the release's own digests. */
const BUILDS: Readonly<Record<string, { readonly file: string; readonly sha256: string }>> = {
  "darwin-arm64": {
    file: "darwin_arm64.tar.gz",
    sha256: "b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5",
  },
  "darwin-x64": {
    file: "darwin_x64.tar.gz",
    sha256: "dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709",
  },
  "linux-arm64": {
    file: "linux_arm64.tar.gz",
    sha256: "e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080",
  },
  "linux-x64": {
    file: "linux_x64.tar.gz",
    sha256: "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb",
  },
  "win32-arm64": {
    file: "windows_arm64.zip",
    sha256: "b95f5e4f5c425cedca7ee203d9afd29597e692c4924a12ed42f970537c72cc0f",
  },
  "win32-x64": {
    file: "windows_x64.zip",
    sha256: "d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e",
  },
};

/** A reason the push stops, said to the person pushing. */
export class GitleaksError extends Error {}

/** The archive to download for this computer, and its checksum; none for a build Gitleaks lacks. */
export function buildFor(
  platform: NodeJS.Platform,
  arch: string,
): { readonly url: string; readonly sha256: string; readonly zip: boolean } | undefined {
  const build = BUILDS[`${platform}-${arch}`];
  if (build === undefined) return undefined;
  const name = `gitleaks_${GITLEAKS_VERSION}_${build.file}`;
  return {
    url: `https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/${name}`,
    sha256: build.sha256,
    zip: build.file.endsWith(".zip"),
  };
}

/** Refuses `bytes` unless their SHA-256 is `sha256`. */
export function checked(bytes: Uint8Array, sha256: string): void {
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== sha256) {
    throw new GitleaksError(
      [
        `The Gitleaks ${GITLEAKS_VERSION} download didn't match its pinned SHA-256, so it wasn't run`,
        "and the push stopped.",
        `Expected ${sha256}, got ${actual}.`,
        "Push again to download it again. If it keeps happening, don't push: tell the team, as the",
        "release may have been changed.",
      ].join("\n"),
    );
  }
}

const NO_COMMIT = /^0+$/;

/**
 * The commits to scan for each ref git is pushing, as `git log` arguments: from git's pre-push
 * lines (`<local ref> <local sha> <remote ref> <remote sha>`). A deleted ref has none; a new branch,
 * or one whose remote commit this clone hasn't fetched, has those not on any remote yet.
 */
export function rangesToScan(stdin: string, known: (sha: string) => boolean): string[] {
  const ranges: string[] = [];
  for (const line of stdin.split(/\r?\n/)) {
    const [, local, , remote] = line.trim().split(/\s+/);
    if (local === undefined || remote === undefined || NO_COMMIT.test(local)) continue;
    ranges.push(
      NO_COMMIT.test(remote) || !known(remote) ? `${local} --not --remotes` : `${remote}..${local}`,
    );
  }
  return ranges;
}

type Install = {
  readonly platform: NodeJS.Platform;
  readonly arch: string;
  readonly download: (url: string) => Promise<Uint8Array>;
  /** Writes the archive's `gitleaks` binary into `into`. */
  readonly extract: (archive: string, into: string, zip: boolean) => void;
};

/** The Gitleaks binary under `dir`, downloaded and checked first if it isn't there yet. */
export async function ensureGitleaks(dir: string, install: Install): Promise<string> {
  const binary = join(
    dir,
    GITLEAKS_VERSION,
    install.platform === "win32" ? "gitleaks.exe" : "gitleaks",
  );
  if (existsSync(binary)) return binary;
  const build = buildFor(install.platform, install.arch);
  if (build === undefined) {
    throw new GitleaksError(
      `Gitleaks ${GITLEAKS_VERSION} has no build for ${install.platform} on ${install.arch}, so the push stopped.`,
    );
  }
  let bytes: Uint8Array;
  try {
    bytes = await install.download(build.url);
  } catch (error) {
    throw new GitleaksError(
      [
        `Couldn't download Gitleaks ${GITLEAKS_VERSION} (${error instanceof Error ? error.message : String(error)}),`,
        "so the push stopped: every push is checked for secrets first.",
        "Check the connection and push again.",
      ].join("\n"),
    );
  }
  checked(bytes, build.sha256);
  // Unpacked beside where it goes, then moved there whole: a push stopped halfway leaves no binary.
  const part = join(dir, `${GITLEAKS_VERSION}.part-${process.pid}`);
  rmSync(part, { recursive: true, force: true });
  mkdirSync(part, { recursive: true });
  try {
    const archive = join(part, build.zip ? "gitleaks.zip" : "gitleaks.tar.gz");
    writeFileSync(archive, bytes);
    install.extract(archive, part, build.zip);
    const unpacked = join(part, install.platform === "win32" ? "gitleaks.exe" : "gitleaks");
    if (!existsSync(unpacked)) {
      throw new GitleaksError(`The Gitleaks ${GITLEAKS_VERSION} archive had no gitleaks in it.`);
    }
    if (install.platform !== "win32") chmodSync(unpacked, 0o755);
    mkdirSync(join(dir, GITLEAKS_VERSION), { recursive: true });
    renameSync(unpacked, binary);
  } finally {
    rmSync(part, { recursive: true, force: true });
  }
  return binary;
}

/** Downloads `url`, following GitHub's redirect to its storage. */
async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Unpacks the archive's binary with the system's tar. On Windows that's `System32\tar.exe`
 * (bsdtar), which reads a zip; Git for Windows' own tar, first on a hook's PATH, doesn't.
 */
function extract(archive: string, into: string, zip: boolean): void {
  const tar =
    process.platform === "win32"
      ? join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe")
      : "tar";
  execFileSync(tar, ["-xf", archive, "-C", into, zip ? "gitleaks.exe" : "gitleaks"]);
}

/** Scans the commits `logOpts` names (all of them, with none); whether any holds a secret. */
function scan(binary: string, repo: string, logOpts: string | undefined): boolean {
  const args = [
    "git",
    repo,
    "--config",
    join(repo, ".gitleaks.toml"),
    "--redact",
    "--no-banner",
    "--verbose",
    "--exit-code",
    "1",
    ...(logOpts === undefined ? [] : ["--log-opts", logOpts]),
  ];
  try {
    execFileSync(binary, args, { stdio: "inherit" });
    return false;
  } catch (error) {
    const status = (error as { status?: unknown }).status;
    if (status === 1) return true;
    throw new GitleaksError(
      `Gitleaks couldn't scan the commits (exit ${String(status)}), so the push stopped.`,
    );
  }
}

const FOUND = [
  "",
  "Gitleaks found what looks like a secret in the commits being pushed (each file and line is above),",
  "so the push stopped.",
  "- A real secret: take it out of every commit that holds it, then push again. Revoke it too if it",
  "  could have been copied anywhere.",
  "- A made-up value a test needs: allow it in .gitleaks.toml, by path or value, with a reason.",
].join("\n");

async function main(args: readonly string[]): Promise<number> {
  const repo = resolve(import.meta.dirname, "../..");
  const git = (...gitArgs: string[]) =>
    execFileSync("git", gitArgs, { cwd: repo, encoding: "utf8" }).trim();
  const history = args.includes("--history");
  const ranges = history
    ? [undefined]
    : rangesToScan(readFileSync(0, "utf8"), (sha) => {
        try {
          git("cat-file", "-e", `${sha}^{commit}`);
          return true;
        } catch {
          return false;
        }
      });
  if (ranges.length === 0) return 0;
  const dir = join(resolve(repo, git("rev-parse", "--git-common-dir")), "gitleaks");
  const binary = await ensureGitleaks(dir, {
    platform: process.platform,
    arch: process.arch,
    download,
    extract,
  });
  let found = false;
  for (const range of ranges) found = scan(binary, repo, range) || found;
  if (found) console.error(FOUND);
  return found ? 1 : 0;
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    if (!(error instanceof GitleaksError)) throw error;
    console.error(error.message);
    process.exitCode = 1;
  }
}
