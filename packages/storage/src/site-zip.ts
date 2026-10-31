import { randomBytes } from "node:crypto";
import { open, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { WebforgeError } from "@webforge/errors";
import {
  migrateSite,
  SITE_NAME_MAX,
  type SiteDoc,
  SiteFormatError,
  siteDocuments,
  siteFromDocuments,
} from "@webforge/model";
// Its browser build: the same synchronous API without the Node build's own `require`, which clashes
// with the one the desktop app's main bundle declares in a chunk it shares.
import { unzipSync, Zip, ZipDeflate, ZipPassThrough } from "fflate/browser";
import { z } from "zod";
import { sha256 } from "./connection.js";
import type { ProjectStore, VersionInfo } from "./project-store.js";
import {
  fillFromSitePackage,
  packageBlobs,
  packageProject,
  type SitePackage,
  sitePackageProjectSchema,
} from "./site-package.js";

// A site as a ZIP file (4.7, F-SITE-5): its site package (A26) and its versions as plain JSON and
// the original files, for backup or moving a site, which opens again as a new site with nothing
// lost. The layout is documented in docs/site-zip.md; keep the two in step.

/** The entry that says what the ZIP holds, and where. */
export const SITE_ZIP_MANIFEST = "manifest.json";

/** The entry holding the site itself. */
const SITE_ENTRY = "site.json";

/** What a site's ZIP says it is, so another ZIP is never taken for one. */
const SITE_ZIP_FORMAT = "webforge-site-zip";

/** The layout this build writes; a ZIP of a later one is from a newer app. */
const SITE_ZIP_VERSION = 1;

/**
 * The most a site's ZIP may hold, unpacked, and the most entries: what a ZIP holds without ZIP64,
 * which fflate doesn't write. Reading checks it before unpacking anything, so a crafted ZIP can't
 * ask for more memory than this.
 */
const SITE_ZIP_MAX_BYTES = 0xffff_ffff;
const SITE_ZIP_MAX_ENTRIES = 0xffff;
/** The manifest is a list of entries: a few MB at most for any real site. */
const MANIFEST_MAX_BYTES = 16 * 1024 * 1024;

/** Entries already compressed (the media): stored as they are. */
const STORED = /^(?:media|files)\//;

/** Every entry's date: a fixed one, so the same site always makes the same ZIP. */
const ENTRY_DATE = new Date(2000, 0, 1);

/**
 * Why a ZIP can't be opened as a site, or a site can't be saved as one.
 * - `not-a-site-zip`: not a ZIP, or a ZIP without a site's manifest.
 * - `damaged`: a site's ZIP with a missing or changed file, or a site or version that isn't one.
 * - `newer-format`: made by a newer app.
 * - `too-large`: more than a ZIP holds.
 */
export type SiteZipErrorCode = "not-a-site-zip" | "damaged" | "newer-format" | "too-large";

/** What the person is told for each {@link SiteZipErrorCode}. */
const SITE_ZIP_MESSAGES = {
  "not-a-site-zip": "site.openFailed.notASite",
  damaged: "site.openFailed.damaged",
  "newer-format": "site.openFailed.newer",
  "too-large": "site.zip.tooLarge",
} as const satisfies Record<SiteZipErrorCode, string>;

/** A ZIP that can't be read as a site, or a site that can't be written as one. */
export class SiteZipError extends WebforgeError<SiteZipErrorCode> {
  override readonly name = "SiteZipError";

  constructor(code: SiteZipErrorCode, message: string, options?: ErrorOptions) {
    super(code, SITE_ZIP_MESSAGES[code], message, options);
  }
}

const hashSchema = z.string().regex(/^[0-9a-f]{64}$/);
/** An entry's name: a relative path of plain parts. */
const entryPathSchema = z
  .string()
  .min(1)
  .max(1000)
  .refine((path) => path.split("/").every((part) => part !== "" && part !== "." && part !== ".."));
const mimeSchema = z
  .string()
  .max(255)
  .regex(/^[\w.+-]+\/[\w.+-]+$/);

const manifestSchema = z.strictObject({
  format: z.literal(SITE_ZIP_FORMAT),
  version: z.int().positive(),
  name: z.string().min(1).max(SITE_NAME_MAX),
  /** Each Media item's original file, as imported, with its name and dimensions. */
  media: z.array(
    z.strictObject({
      mediaId: z.string().min(1).max(100),
      path: entryPathSchema,
      mime: mimeSchema,
      width: z.int().positive().optional(),
      height: z.int().positive().optional(),
      originalName: z.string().min(1).max(1000),
      sha256: hashSchema,
    }),
  ),
  /** Other files the site names by their SHA-256, such as bundled code. */
  files: z.array(z.strictObject({ path: entryPathSchema, mime: mimeSchema, sha256: hashSchema })),
  /** Saved versions, newest first, each a site as `site.json` is. */
  versions: z.array(
    z.strictObject({
      id: z.string().min(1).max(100),
      name: z.string().max(1000),
      kind: z.enum(["manual", "auto"]),
      createdAt: z.iso.datetime(),
      path: entryPathSchema,
    }),
  ),
  /** What the project keeps beside its site that a round trip keeps. */
  project: sitePackageProjectSchema,
});

type Manifest = z.infer<typeof manifestSchema>;

/** A site read from its ZIP and checked, ready to fill a new project with. */
export type SiteZip = {
  readonly name: string;
  /** The site, with the Media and files it and its versions reach. */
  readonly sitePackage: SitePackage;
  /** Newest first, as {@link ProjectStore.listVersions} lists them. */
  readonly versions: readonly { readonly version: VersionInfo; readonly site: SiteDoc }[];
};

const encoder = new TextEncoder();
const utf8 = new TextDecoder("utf-8", { fatal: true });

/** A JSON entry: indented, so the ZIP reads in any text editor. */
const jsonEntry = (value: unknown) => encoder.encode(`${JSON.stringify(value, null, 2)}\n`);

/** Characters no file name may have on Windows, macOS or Linux. */
const UNSAFE_IN_FILE_NAMES = /[<>:"/\\|?*\p{Cc}]/gu;

/** `name` as a file name any system can unpack: unsafe characters as "-", never empty. */
function fileName(name: string): string {
  const cleaned = name
    .replace(UNSAFE_IN_FILE_NAMES, "-")
    .trim()
    .replace(/[. ]+$/, "");
  return cleaned === "" ? "file" : cleaned;
}

/**
 * An id as part of an entry's name: percent-encoded, `*` and the like too, so every name unpacks
 * on Windows, macOS and Linux, and two ids never share one.
 */
const entryPart = (id: string) =>
  encodeURIComponent(id).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/**
 * `raw`, a site as stored or as a ZIP holds it, migrated to this app's format, as opening a
 * `.wforge` file migrates it; `what` names it in the {@link SiteZipError} thrown when it isn't a
 * site this app opens.
 */
function siteFrom(raw: unknown, what: string): SiteDoc {
  try {
    return migrateSite(raw);
  } catch (error) {
    if (error instanceof SiteFormatError && error.code === "newer-format") {
      throw new SiteZipError("newer-format", `${what} comes from a newer app`, { cause: error });
    }
    throw new SiteZipError("damaged", `${what} is not a site`, { cause: error });
  }
}

/**
 * The entries of the site in `store`'s ZIP, the manifest first: the site, its versions, the Media
 * originals and other files they reach, and the project's choices.
 */
export function siteZipEntries(store: ProjectStore): Map<string, Uint8Array> {
  const site = siteFrom(siteFromDocuments(store.readDocuments()), "The site");
  const versions = store.listVersions().map((version) => ({
    version,
    site: siteFrom(siteFromDocuments(store.readVersion(version.id) ?? []), "A version"),
  }));
  const { media, files } = packageBlobs(store, [site, ...versions.map((each) => each.site)]);

  const entries = new Map<string, Uint8Array>([[SITE_ENTRY, jsonEntry(site)]]);
  const versionEntries = versions.map(({ version, site: versionSite }) => {
    const path = `versions/${entryPart(version.id)}.json`;
    entries.set(path, jsonEntry(versionSite));
    return { ...version, path };
  });
  const mediaEntries = media.map((item) => {
    const path = `media/${entryPart(item.mediaId)}/${fileName(item.originalName)}`;
    entries.set(path, item.data);
    return {
      mediaId: item.mediaId,
      path,
      mime: item.mime,
      ...(item.width === undefined ? {} : { width: item.width }),
      ...(item.height === undefined ? {} : { height: item.height }),
      originalName: item.originalName,
      sha256: item.hash,
    };
  });
  const fileEntries = files.map((file) => {
    const path = `files/${file.hash}`;
    entries.set(path, file.data);
    return { path, mime: file.mime, sha256: file.hash };
  });

  const manifest: Manifest = {
    format: SITE_ZIP_FORMAT,
    version: SITE_ZIP_VERSION,
    name: store.info.name,
    media: mediaEntries,
    files: fileEntries,
    versions: versionEntries,
    project: packageProject(store),
  };
  return new Map([[SITE_ZIP_MANIFEST, jsonEntry(manifest)], ...entries]);
}

/** Throws a `too-large` {@link SiteZipError} when `entries` won't fit in a ZIP. */
function checkFits(entries: ReadonlyMap<string, Uint8Array>): void {
  let bytes = 0;
  for (const [path, data] of entries) {
    // A local header and a central directory entry, each with the path.
    bytes += data.byteLength + 76 + 2 * encoder.encode(path).byteLength;
  }
  if (entries.size > SITE_ZIP_MAX_ENTRIES || bytes > SITE_ZIP_MAX_BYTES) {
    throw new SiteZipError("too-large", "The site is too large for a ZIP file");
  }
}

/**
 * Saves the site in `store` as a ZIP at `destination`, a file the person chose in the save dialog
 * (which asked before replacing one). It's written beside the destination one entry at a time and
 * then moved into place, so a failure leaves what was there as it was.
 */
export async function writeSiteZip(store: ProjectStore, destination: string): Promise<void> {
  const entries = siteZipEntries(store);
  checkFits(entries);
  const staging = join(
    dirname(destination),
    `.${basename(destination)}.webforge-new-${randomBytes(4).toString("hex")}`,
  );
  try {
    const handle = await open(staging, "w");
    try {
      let written: Promise<unknown> = Promise.resolve();
      let failed: Error | null = null;
      const zip = new Zip((error, piece) => {
        if (error !== null) failed = error;
        else written = written.then(() => handle.write(piece));
      });
      for (const [path, data] of entries) {
        const entry = STORED.test(path)
          ? new ZipPassThrough(path)
          : new ZipDeflate(path, { level: 6 });
        entry.mtime = ENTRY_DATE;
        zip.add(entry);
        entry.push(data, true);
        await written;
        if (failed !== null) throw failed;
      }
      zip.end();
      await written;
      if (failed !== null) throw failed;
    } finally {
      await handle.close();
    }
    await rename(staging, destination);
  } catch (error) {
    await rm(staging, { force: true });
    throw error;
  }
}

/**
 * Reads the site in a ZIP's bytes (`data`), as the person chose it in the open dialog: untrusted.
 * Before unpacking anything, the ZIP's size and entries are checked; then only the entries its
 * manifest lists are unpacked, each file's bytes checked against its SHA-256, and the site and
 * each version read through `migrateSite`. Throws a {@link SiteZipError}.
 */
export function readSiteZip(data: Uint8Array): SiteZip {
  if (data.byteLength > SITE_ZIP_MAX_BYTES) {
    throw new SiteZipError("too-large", "The ZIP is larger than a site's ZIP can be");
  }
  // First what it holds, unpacking nothing but the manifest.
  let entries = 0;
  let unpacked = 0;
  let manifestEntry: Record<string, Uint8Array>;
  try {
    manifestEntry = unzipSync(data, {
      filter: (file) => {
        entries += 1;
        unpacked += file.originalSize;
        return file.name === SITE_ZIP_MANIFEST && file.originalSize <= MANIFEST_MAX_BYTES;
      },
    });
  } catch (error) {
    throw new SiteZipError("not-a-site-zip", "The file is not a ZIP", { cause: error });
  }
  if (entries > SITE_ZIP_MAX_ENTRIES || unpacked > SITE_ZIP_MAX_BYTES) {
    throw new SiteZipError("too-large", "The ZIP holds more than a site's ZIP can");
  }
  const manifestData = manifestEntry[SITE_ZIP_MANIFEST];
  if (manifestData === undefined) {
    throw new SiteZipError("not-a-site-zip", "The ZIP has no site manifest");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(utf8.decode(manifestData));
  } catch (error) {
    throw new SiteZipError("not-a-site-zip", "The manifest is not JSON", { cause: error });
  }
  const format = z.object({ format: z.literal(SITE_ZIP_FORMAT), version: z.int() }).safeParse(raw);
  if (!format.success) {
    throw new SiteZipError("not-a-site-zip", "The ZIP is not a site's ZIP");
  }
  if (format.data.version > SITE_ZIP_VERSION) {
    throw new SiteZipError("newer-format", "The ZIP comes from a newer app");
  }
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SiteZipError("damaged", "The manifest is not valid", { cause: parsed.error });
  }
  const manifest = parsed.data;

  // Then the entries the manifest lists, and no others.
  const wanted = new Set([
    SITE_ENTRY,
    ...manifest.media.map((entry) => entry.path),
    ...manifest.files.map((entry) => entry.path),
    ...manifest.versions.map((version) => version.path),
  ]);
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data, { filter: (file) => wanted.has(file.name) });
  } catch (error) {
    throw new SiteZipError("damaged", "The ZIP can't be unpacked", { cause: error });
  }
  /** An entry's bytes, which must have `hash`. */
  const checked = (path: string, hash: string) => {
    const bytes = files[path];
    if (bytes === undefined || sha256(bytes) !== hash) {
      throw new SiteZipError("damaged", `"${path}" is missing or changed`);
    }
    return bytes;
  };
  /** The site in entry `path`, read through `migrateSite`. */
  const siteAt = (path: string, what: string) => {
    const bytes = files[path];
    if (bytes === undefined) throw new SiteZipError("damaged", `"${path}" is missing`);
    let site: unknown;
    try {
      site = JSON.parse(utf8.decode(bytes));
    } catch (error) {
      throw new SiteZipError("damaged", `"${path}" is not JSON`, { cause: error });
    }
    return siteFrom(site, what);
  };

  const site = siteAt(SITE_ENTRY, "The site");
  const versions = manifest.versions.map(({ path, ...version }) => ({
    version,
    site: siteAt(path, `Version "${version.name}"`),
  }));
  return {
    name: manifest.name,
    sitePackage: {
      site,
      media: manifest.media.map((item) => ({
        mediaId: item.mediaId,
        data: checked(item.path, item.sha256),
        mime: item.mime,
        width: item.width,
        height: item.height,
        originalName: item.originalName,
        hash: item.sha256,
      })),
      files: manifest.files.map((file) => ({
        mime: file.mime,
        data: checked(file.path, file.sha256),
        hash: file.sha256,
      })),
      project: manifest.project,
    },
    versions,
  };
}

/**
 * Fills `store`, a new, empty project, with the site read from a ZIP: its package (the files,
 * Media, site and project's choices), then its versions in their order. The project's id and
 * creation time stay the new file's own, so publishing tells the copy from the original (A8).
 */
export function fillFromSiteZip(store: ProjectStore, zip: SiteZip): void {
  fillFromSitePackage(store, zip.sitePackage);
  // Oldest first, so they list in the same order.
  for (const { version, site } of [...zip.versions].reverse()) {
    store.addVersion(version, siteDocuments(site));
  }
}
