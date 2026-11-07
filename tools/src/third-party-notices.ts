// Third-party notices (5.3, rule C1): every package the desktop app ships, with its licence's name
// and text, written at build time beside the app (`out/notices`) for the Open-Source Licences
// screen and as THIRD_PARTY_NOTICES.txt.
//
// The app's build (apps/desktop/electron.vite.config.ts) gives it:
// - the files its three bundles loaded (`this.getModuleIds()`): each one under `node_modules`
//   names a package the bundles hold, as the editor's React, the pipeline's codecs and the
//   editor's fonts;
// - the packages that ship as they are: the main process's dependencies, which electron-builder
//   copies into the app with all of theirs, the fonts the installer carries (2.2), and Electron.
//
// This file has no relative imports so Node can run it directly with type stripping.

import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";

/** One package the app ships, as the notices list it. */
export type Notice = {
  readonly name: string;
  readonly version: string;
  /** Its licence, as its package.json names it (an SPDX expression, usually). */
  readonly licence: string;
  /** Its home page or repository, when its package.json gives one. */
  readonly homepage?: string;
  /** Its licence and notice files, as the package ships them; none when it has none. */
  readonly text?: string;
};

/** The notices file the build writes and the main process reads: `out/notices/notices.json`. */
export const NOTICES_FILE = "notices.json";

/** The plain-text notices the build writes beside it. */
export const NOTICES_TEXT_FILE = "THIRD_PARTY_NOTICES.txt";

/** A licence or notice file of a package: LICENSE, LICENCE.md, LICENSE-MIT, COPYING, NOTICE… */
const LICENCE_FILE = /^(?:licen[cs]e|copying|notice)(?:[.\-_].*)?$/i;

/** Code or data that happens to be named so (`license.js`, `licenses.json`): not a licence. */
const CODE_FILE = /\.(?:[cm]?[jt]sx?|json|map)$/i;

const licenceField = z.union([
  z.string(),
  z.object({ type: z.string() }),
  z.array(z.object({ type: z.string() })),
]);

const manifestSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  license: licenceField.optional(),
  licenses: licenceField.optional(),
  homepage: z.string().optional(),
  repository: z.union([z.string(), z.object({ url: z.string() })]).optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  optionalDependencies: z.record(z.string(), z.string()).optional(),
});

type Manifest = z.infer<typeof manifestSchema>;

/** A package.json's licence as one expression: `MIT`, or `(MIT OR Apache-2.0)` from a legacy list. */
function licenceOf(manifest: Manifest): string {
  const field = manifest.license ?? manifest.licenses;
  if (field === undefined) return "UNKNOWN";
  if (typeof field === "string") return field;
  if (Array.isArray(field)) {
    const types = field.map(({ type }) => type);
    return types.length === 1 ? (types[0] ?? "UNKNOWN") : `(${types.join(" OR ")})`;
  }
  return field.type;
}

/** Where to read about a package: its home page, or its repository as a web address. */
function homepageOf(manifest: Manifest): string | undefined {
  const repository =
    typeof manifest.repository === "string" ? manifest.repository : manifest.repository?.url;
  const address = manifest.homepage ?? repository;
  if (address === undefined) return undefined;
  const web = address
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^github:/, "https://github.com/")
    .replace(/\.git$/, "");
  return /^https?:\/\//.test(web) ? web : undefined;
}

/** The package.json in `dir`, checked; undefined when it has none, or one without a name. */
function readManifest(dir: string): Manifest | undefined {
  const path = join(dir, "package.json");
  if (!existsSync(path)) return undefined;
  const parsed = manifestSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  return parsed.success ? parsed.data : undefined;
}

/**
 * The folder of the package that file `moduleId` belongs to, from the last `node_modules` in its
 * path (`…/node_modules/@scope/name/…`); undefined for a file outside one, as the app's own
 * packages are, or an id that isn't a file (`\0virtual`). A query (`?inline`) is left out.
 */
export function packageDirOf(moduleId: string): string | undefined {
  if (moduleId.startsWith("\0")) return undefined;
  const path = moduleId.replace(/\?.*$/, "").replaceAll("\\", "/");
  const marker = "/node_modules/";
  const at = path.lastIndexOf(marker);
  if (at === -1) return undefined;
  const rest = path.slice(at + marker.length).split("/");
  const [first, second] = rest;
  if (first === undefined || first === "" || first.startsWith(".")) return undefined;
  const name = first.startsWith("@")
    ? second === undefined
      ? undefined
      : `${first}/${second}`
    : first;
  return name === undefined ? undefined : path.slice(0, at + marker.length) + name;
}

/**
 * The folder package `name` resolves to from `fromDir`, as Node finds it: the first
 * `node_modules/<name>` up from there, its links followed (pnpm's store). Undefined when none.
 */
export function findPackageDir(fromDir: string, name: string): string | undefined {
  let dir = fromDir;
  for (;;) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate);
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * The folders of packages `names`, resolved from `fromDir`, and of every package they depend on
 * in turn: what electron-builder copies into the app for the main process's dependencies. An
 * optional dependency that isn't installed is skipped; a missing required one throws, since the
 * app couldn't run without it.
 */
export function dependencyDirs(fromDir: string, names: readonly string[]): Set<string> {
  const found = new Set<string>();
  const visit = (from: string, name: string, optional: boolean) => {
    const dir = findPackageDir(from, name);
    if (dir === undefined) {
      if (optional) return;
      throw new Error(`The dependency ${name} isn't installed: run pnpm install`);
    }
    if (found.has(dir)) return;
    found.add(dir);
    const manifest = readManifest(dir);
    for (const each of Object.keys(manifest?.dependencies ?? {})) visit(dir, each, false);
    for (const each of Object.keys(manifest?.optionalDependencies ?? {})) visit(dir, each, true);
  };
  for (const name of names) visit(fromDir, name, false);
  return found;
}

/** The licence and notice files in `dir`, as one text, in name order; undefined when none. */
function licenceTextIn(dir: string): string | undefined {
  const files = readdirSync(dir, { withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && LICENCE_FILE.test(entry.name) && !CODE_FILE.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort();
  if (files.length === 0) return undefined;
  return files
    .map((file) => readFileSync(join(dir, file), "utf8").replaceAll("\r\n", "\n").trim())
    .join("\n\n");
}

/**
 * The notices of the packages in `dirs`: one per name and version, sorted by name, the app's own
 * (`@webforge/…`) left out.
 */
export function collectNotices(dirs: Iterable<string>): Notice[] {
  const notices = new Map<string, Notice>();
  for (const dir of dirs) {
    const manifest = readManifest(dir);
    if (manifest === undefined || manifest.name.startsWith("@webforge/")) continue;
    const key = `${manifest.name}@${manifest.version}`;
    if (notices.has(key)) continue;
    const homepage = homepageOf(manifest);
    const text = licenceTextIn(dir);
    notices.set(key, {
      name: manifest.name,
      version: manifest.version,
      licence: licenceOf(manifest),
      ...(homepage === undefined ? {} : { homepage }),
      ...(text === undefined ? {} : { text }),
    });
  }
  return [...notices.values()].sort(
    (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) || (a.version < b.version ? -1 : 1),
  );
}

/** The notices as THIRD_PARTY_NOTICES.txt has them: each package, its licence, and its text. */
export function formatNotices(notices: readonly Notice[]): string {
  const rule = "=".repeat(78);
  const entries = notices.map((notice) =>
    [
      rule,
      `${notice.name} ${notice.version}`,
      `Licence: ${notice.licence}`,
      ...(notice.homepage === undefined ? [] : [notice.homepage]),
      "",
      notice.text ?? "(The package includes no licence file.)",
      "",
    ].join("\n"),
  );
  return [
    "Third-party software notices",
    "",
    "This program includes the open-source software below, each under its own licence.",
    "Electron includes Chromium, whose licences are in LICENSES.chromium.html, installed with it.",
    "",
    ...entries,
  ].join("\n");
}

/** Writes the notices into `target`: {@link NOTICES_FILE} and {@link NOTICES_TEXT_FILE}. */
export async function writeNotices(target: string, notices: readonly Notice[]): Promise<void> {
  await mkdir(target, { recursive: true });
  await writeFile(join(target, NOTICES_FILE), `${JSON.stringify({ packages: notices })}\n`);
  await writeFile(join(target, NOTICES_TEXT_FILE), formatNotices(notices));
}
