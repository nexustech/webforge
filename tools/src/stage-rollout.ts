// Moves a release to the Stable channel, to some of the people on it at first (5.2, spec/03 §10;
// docs/releasing.md). A release reaches Beta when its draft is published as a prerelease, and
// Stable once it's the repository's latest release, which this makes it.
//
// It sets `stagingPercentage` in the release's Stable feed files (`latest.yml`, `latest-mac.yml`):
// electron-updater then offers the update to that share of Stable's installations, each by an id it
// keeps, so raising the share later reaches the same people and more. 100 removes the limit. Beta
// reads its own copies (`beta.yml`, `beta-mac.yml`), which this leaves alone.
//
// Usage: node tools/src/stage-rollout.ts <tag> <percent>
//   e.g. node tools/src/stage-rollout.ts v1.2.0 20, then v1.2.0 100 once it's gone well.
// It runs GitHub's CLI (`gh`), signed in with write access to the repository.
//
// This file has no relative imports so Node can run it directly with type stripping.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

/** Stable's feed files, by electron-updater's names for the default channel on each OS. */
const STABLE_FEED_FILES = ["latest.yml", "latest-mac.yml"] as const;

const STAGING_LINE = /^stagingPercentage:.*(?:\r?\n|$)/gm;

/**
 * `feed` (a feed file's YAML) offered to `percent` of the installations: its `stagingPercentage`
 * set, or removed for 100. The rest is left as electron-builder wrote it.
 */
export function withStagingPercentage(feed: string, percent: number): string {
  const rest = feed.replace(STAGING_LINE, "");
  if (percent === 100) return rest;
  return `${rest}${rest === "" || rest.endsWith("\n") ? "" : "\n"}stagingPercentage: ${percent}\n`;
}

/** The share of Stable's installations, as a whole percentage: 1 to 100. */
const percentSchema = z.coerce.number().int().min(1).max(100);

/** What the command line asks for: a release's tag and the share, or what's wrong. */
export function parseArgs(
  args: readonly string[],
): { readonly tag: string; readonly percent: number } | { readonly error: string } {
  const [tag, percent, ...rest] = args;
  if (tag === undefined || percent === undefined || rest.length > 0 || !/^v\S+$/.test(tag)) {
    return { error: "Usage: node tools/src/stage-rollout.ts <tag, e.g. v1.2.0> <percent, 1-100>" };
  }
  const parsed = percentSchema.safeParse(percent);
  if (!parsed.success)
    return { error: `The percentage is a whole number from 1 to 100: ${percent}` };
  return { tag, percent: parsed.data };
}

/** What `gh release view --json isDraft,isPrerelease,assets` says of a release. */
const releaseSchema = z.object({
  isDraft: z.boolean(),
  isPrerelease: z.boolean(),
  assets: z.array(z.object({ name: z.string() })),
});

/** Runs GitHub's CLI with `args` and gives what it printed. */
export type Gh = (args: readonly string[]) => string;

/** {@link Gh} on the real `gh`, which fails on a failing command. */
const realGh: Gh = (args) => execFileSync("gh", args, { encoding: "utf8" });

/**
 * Offers release `tag` to `percent` of Stable: its Stable feed files' `stagingPercentage` set, and
 * then, if it's still a prerelease (Beta only), made the latest release. The feed files change first,
 * so Stable never sees the release offered to everyone. Gives what it did, line by line.
 */
export function stageRollout(tag: string, percent: number, gh: Gh = realGh): string[] {
  const release = releaseSchema.parse(
    JSON.parse(gh(["release", "view", tag, "--json", "isDraft,isPrerelease,assets"])),
  );
  if (release.isDraft) {
    throw new Error(`${tag} is still a draft: publish it as a prerelease (Beta) first.`);
  }
  const names = new Set(release.assets.map((asset) => asset.name));
  const feeds = STABLE_FEED_FILES.filter((name) => names.has(name));
  if (feeds.length === 0) {
    throw new Error(`${tag} has no ${STABLE_FEED_FILES.join(" or ")}: it isn't an app release.`);
  }
  const done: string[] = [];
  const dir = mkdtempSync(join(tmpdir(), "webforge-rollout-"));
  try {
    for (const name of feeds) {
      gh(["release", "download", tag, "--pattern", name, "--dir", dir, "--clobber"]);
      const file = join(dir, name);
      writeFileSync(file, withStagingPercentage(readFileSync(file, "utf8"), percent));
      gh(["release", "upload", tag, file, "--clobber"]);
      done.push(`${name}: offered to ${percent}% of Stable.`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  if (release.isPrerelease) {
    gh(["release", "edit", tag, "--prerelease=false", "--latest"]);
    done.push(`${tag} is the latest release now: Stable gets it.`);
  }
  return done;
}

if (import.meta.main) {
  const args = parseArgs(process.argv.slice(2));
  if ("error" in args) {
    console.error(args.error);
    process.exitCode = 2;
  } else {
    try {
      for (const line of stageRollout(args.tag, args.percent)) console.log(line);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
}
