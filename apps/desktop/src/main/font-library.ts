import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fontRefSchema } from "@webforge/model";
import {
  allowedLicence,
  type CatalogueFont,
  catalogueFont,
  catalogueFontSchema,
  FONT_CATALOGUE,
  FONT_CATEGORIES,
  FONTSOURCE_API,
  type FontCategory,
  type FontFallback,
  fontAxesSchema,
  fontCategory,
  fontIdSchema,
  fontMetadataSchema,
  fontPackage,
  PACKAGE_FILES,
  PACKAGE_LISTINGS,
  planFamily,
} from "@webforge/themes";
import type { IpcMain } from "electron";
import { z } from "zod";
import type {
  BrowsableFont,
  FontBrowseResult,
  FontDownloadResult,
  InstalledFont,
} from "../shared/ipc/fonts.js";
import { createFontReader, type ExpectedFont, type FontReader } from "./fonts.js";
import { registerIpcHandler } from "./ipc.js";

/** Where fonts are downloaded from: Fontsource's API, and jsDelivr's copies of its packages. */
export type FontSources = {
  /** Fontsource's API, pinned to v1: every font's metadata. */
  readonly api: string;
  /** A package's files: `<files>/<package>@<version>/files/<file>`. */
  readonly files: string;
  /** A package's versions, and its files with their sizes and SHA-256. */
  readonly listings: string;
};

/** The real sources (PH2-8). */
const FONTSOURCE: FontSources = {
  api: FONTSOURCE_API,
  files: PACKAGE_FILES,
  listings: PACKAGE_LISTINGS,
};

/** Fetches a URL: Electron's `net.fetch` (the system's proxy settings apply), or a fake in tests. */
export type FontFetch = (url: string, init: { readonly signal: AbortSignal }) => Promise<Response>;

/** The downloaded fonts and the list to browse (2.2, S4); see {@link createFontLibrary}. */
export type FontLibrary = {
  /** The bundled fonts, then the ones downloaded on this computer. */
  list(): Promise<InstalledFont[]>;
  /** Fontsource's fonts the app may use, from a list kept for a week (the last one, offline). */
  browse(): Promise<FontBrowseResult>;
  /** Downloads a font once; answers at once for one the computer has. */
  download(id: string): Promise<FontDownloadResult>;
  /** The downloaded families, for the canvas's CSS and an export's fonts. */
  downloaded(): Promise<readonly CatalogueFont[]>;
  /** What a downloaded file must be, by name, or undefined for one that wasn't downloaded. */
  file(name: string): ExpectedFont | undefined;
  /** Reads downloaded files, each checked against its size and SHA-256 first. */
  readonly reader: FontReader;
};

/** How long a list to browse is kept before it's fetched again. */
const BROWSE_FRESH_MS = 7 * 24 * 60 * 60 * 1000;
/** How long one request may take. */
const REQUEST_TIMEOUT_MS = 30_000;
/** The most a list or a package's listing may take (Fontsource's whole list is about 0.5 MB). */
const MAX_JSON_BYTES = 8 * 1024 * 1024;
/** The most one font file may take (a variable font's Latin file is about 50–300 KB). */
const MAX_FONT_BYTES = 4 * 1024 * 1024;
/** At most this many fonts are kept downloaded, and listed. */
const MAX_FONTS = 5_000;

/** The fallback a downloaded display or handwriting font gets: the closest generic family. */
const FALLBACKS: Partial<Record<FontCategory, FontFallback>> = {
  display: "sans-serif",
  handwriting: "serif",
};

/** Why a download or the list failed, as the IPC answer says it. */
type Reason = "offline" | "not-allowed" | "damaged" | "unknown";

class FontSourceError extends Error {
  constructor(readonly reason: Reason) {
    super(reason);
  }
}

const sha256 = (data: Uint8Array, encoding: "hex" | "base64") =>
  createHash("sha256").update(data).digest(encoding);

/** One of Fontsource's whole list (`/v1/fonts`), the parts the browser shows. */
const listedFontSchema = z.object({
  id: fontIdSchema,
  family: fontRefSchema.shape.family,
  subsets: z.array(z.string()),
  category: z.string(),
  license: z.string(),
  variable: z.boolean(),
});

/** A font to browse, as the list on disk keeps it. */
const keptFontSchema = z.strictObject({
  id: fontIdSchema,
  family: fontRefSchema.shape.family,
  category: z.enum(FONT_CATEGORIES),
  variable: z.boolean(),
});
type KeptFont = z.infer<typeof keptFontSchema>;

/** The list to browse, as kept on disk (`browse.json`). */
const keptListSchema = z.strictObject({
  fetchedAt: z.number().int().nonnegative(),
  fonts: z.array(keptFontSchema).max(MAX_FONTS),
});

/** The downloaded families (`downloaded.json`): what each file must be. */
const manifestSchema = z.strictObject({
  families: z.array(catalogueFontSchema).max(MAX_FONTS),
});

/** jsDelivr's answer for a package's latest version. */
const resolvedSchema = z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/) });

/** jsDelivr's flat listing of a package's files; `hash` is the SHA-256 in base64. */
const listingSchema = z.object({
  files: z.array(
    z.object({ name: z.string(), hash: z.string(), size: z.number().int().nonnegative() }),
  ),
});

/** `families` as the picker lists them. */
const installed = (family: CatalogueFont, source: InstalledFont["source"]): InstalledFont => ({
  id: family.id,
  family: family.family,
  fallback: family.fallback,
  category: family.category,
  variable: family.variable,
  source,
});

/** Fontsource's whole list, without the fonts the app can't use (C1, Latin only, listed categories). */
function usableFonts(list: readonly unknown[]): KeptFont[] {
  return list.flatMap((entry) => {
    const font = listedFontSchema.safeParse(entry);
    if (!font.success) return [];
    const { id, family, subsets, license, variable } = font.data;
    const category = fontCategory(font.data.category);
    if (category === undefined || allowedLicence(license) === undefined) return [];
    return subsets.includes("latin") ? [{ id, family, category, variable }] : [];
  });
}

/** Writes `data` to `path` by way of a temporary file, so a crash never leaves half a file. */
async function writeAtomically(path: string, data: string | Uint8Array): Promise<void> {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, data);
  await rename(temporary, path);
}

/**
 * The fonts downloaded on demand (2.2, S4, PH2-8), in `dir` (`userData/fonts`), and Fontsource's
 * list to browse. A download takes the files a bundled font of the same kind would have (Latin
 * and Latin Extended; `planFamily`), refuses a licence C1 doesn't allow, and checks each file's
 * size and SHA-256 against the package's listing before keeping it. `downloaded.json` lists what
 * each kept file must be, and every read checks it again, so a damaged or swapped file never
 * reaches the canvas or a site. Nothing about a download is logged but why it failed.
 */
export function createFontLibrary({
  dir,
  fetch,
  sources = FONTSOURCE,
  now = Date.now,
}: {
  readonly dir: string;
  readonly fetch: FontFetch;
  readonly sources?: FontSources;
  readonly now?: () => number;
}): FontLibrary {
  const manifestPath = join(dir, "downloaded.json");
  const listPath = join(dir, "browse.json");
  const reader = createFontReader(dir);
  /** The downloaded families by id, once read from the manifest. */
  let families: Map<string, CatalogueFont> | undefined;
  /** Downloaded files by name. */
  const files = new Map<string, ExpectedFont>();
  let list: z.infer<typeof keptListSchema> | undefined;
  /** Downloads under way, by id: asking twice waits for the same one. */
  const downloading = new Map<string, Promise<FontDownloadResult>>();
  /** Manifest writes, one after another, so none leaves out a family another one kept. */
  let writing: Promise<unknown> = Promise.resolve();

  const remember = (family: CatalogueFont, into: Map<string, CatalogueFont>) => {
    into.set(family.id, family);
    for (const file of family.files) files.set(file.file, file);
  };

  const loaded = async (): Promise<Map<string, CatalogueFont>> => {
    if (families !== undefined) return families;
    const read = new Map<string, CatalogueFont>();
    try {
      const manifest = manifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
      // A bundled font is the installer's; one listed twice keeps its first entry.
      for (const family of manifest.families) {
        if (catalogueFont(family.id) === undefined && !read.has(family.id)) remember(family, read);
      }
    } catch (error) {
      if ((error as { code?: unknown }).code !== "ENOENT") {
        console.error("Webforge ignored an unreadable list of downloaded fonts");
      }
    }
    families ??= read;
    return families;
  };

  const get = async (url: string, limit: number): Promise<Uint8Array<ArrayBuffer>> => {
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch {
      throw new FontSourceError("offline");
    }
    if (!response.ok || Number(response.headers.get("content-length") ?? 0) > limit) {
      throw new FontSourceError("unknown");
    }
    let data: Uint8Array<ArrayBuffer>;
    try {
      data = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new FontSourceError("offline");
    }
    if (data.byteLength > limit) throw new FontSourceError("unknown");
    return data;
  };

  const getJson = async <T>(url: string, schema: z.ZodType<T>): Promise<T> => {
    const data = await get(url, MAX_JSON_BYTES);
    let json: unknown;
    try {
      json = JSON.parse(new TextDecoder().decode(data));
    } catch {
      throw new FontSourceError("unknown");
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new FontSourceError("unknown");
    return parsed.data;
  };

  /** Fetches family `id`'s files and checks each, as {@link createFontLibrary} says. */
  const fetchFamily = async (id: string) => {
    const metadata = await getJson(`${sources.api}/fonts/${id}`, fontMetadataSchema);
    if (metadata.id !== id) throw new FontSourceError("unknown");
    const category = fontCategory(metadata.category);
    if (
      allowedLicence(metadata.license) === undefined ||
      !metadata.subsets.includes("latin") ||
      category === undefined
    ) {
      throw new FontSourceError("not-allowed");
    }
    const axis = metadata.variable
      ? (await getJson(`${sources.api}/variable/${id}`, fontAxesSchema)).axes.wght
      : undefined;
    const name = fontPackage(id, metadata.variable);
    const { version } = await getJson(
      `${sources.listings}/${name}/resolved?specifier=latest`,
      resolvedSchema,
    );
    const listing = await getJson(
      `${sources.listings}/${name}@${version}?structure=flat`,
      listingSchema,
    );
    let planned: ReturnType<typeof planFamily>;
    try {
      const fallback = FALLBACKS[category];
      planned = planFamily(
        metadata,
        fallback === undefined ? {} : { fallback },
        version,
        axis === undefined ? undefined : [axis.min, axis.max],
      );
    } catch {
      throw new FontSourceError("not-allowed");
    }
    const listed = new Map(listing.files.map((file) => [file.name, file]));
    const fetched = await Promise.all(
      planned.files.map(async (file) => {
        const expected = listed.get(`/files/${file.file}`);
        if (expected === undefined) throw new FontSourceError("unknown");
        const data = await get(
          `${sources.files}/${name}@${version}/files/${file.file}`,
          MAX_FONT_BYTES,
        );
        if (data.byteLength !== expected.size || sha256(data, "base64") !== expected.hash) {
          throw new FontSourceError("damaged");
        }
        return { file, data };
      }),
    );
    const family = catalogueFontSchema.safeParse({
      ...planned,
      files: fetched.map(({ file, data }) => ({
        ...file,
        bytes: data.byteLength,
        sha256: sha256(data, "hex"),
      })),
    });
    // A name or range that a stylesheet couldn't take as it is.
    if (!family.success) throw new FontSourceError("not-allowed");
    return {
      family: family.data,
      data: fetched.map(({ file, data }) => ({ name: file.file, data })),
    };
  };

  /** Keeps a fetched family: its files first, then the manifest that lists them. */
  const keep = async (
    family: CatalogueFont,
    data: readonly { name: string; data: Uint8Array }[],
  ) => {
    await mkdir(dir, { recursive: true });
    for (const file of data) await writeAtomically(join(dir, file.name), file.data);
    const write = writing.then(async () => {
      const next = new Map(await loaded());
      next.set(family.id, family);
      const manifest = { families: [...next.values()] };
      await writeAtomically(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      // Listed once the manifest on disk lists it too.
      remember(family, await loaded());
    });
    writing = write.catch(() => undefined);
    await write;
  };

  const download = async (id: string): Promise<FontDownloadResult> => {
    try {
      const { family, data } = await fetchFamily(id);
      await keep(family, data);
      return { status: "downloaded", font: installed(family, "downloaded") };
    } catch (error) {
      const reason = error instanceof FontSourceError ? error.reason : "unknown";
      console.error(`Webforge could not download a font (${reason})`);
      return { status: "failed", reason };
    }
  };

  const fetchList = async () => {
    // Each entry is read on its own: one Fontsource can't describe leaves the rest listed.
    const listed = await getJson(`${sources.api}/fonts`, z.array(z.unknown()));
    const fresh = { fetchedAt: now(), fonts: usableFonts(listed).slice(0, MAX_FONTS) };
    try {
      await mkdir(dir, { recursive: true });
      await writeAtomically(listPath, JSON.stringify(fresh));
    } catch {
      // Kept in memory only: the next start fetches it again.
    }
    return fresh;
  };

  const keptList = async () => {
    if (list !== undefined) return list;
    try {
      list = keptListSchema.parse(JSON.parse(await readFile(listPath, "utf8")));
    } catch {
      list = undefined;
    }
    return list;
  };

  return {
    reader,
    file: (name) => files.get(name),
    async downloaded() {
      return [...(await loaded()).values()];
    },
    async list() {
      const downloaded = [...(await loaded()).values()];
      return [
        ...FONT_CATALOGUE.map((family) => installed(family, "bundled")),
        ...downloaded.map((family) => installed(family, "downloaded")),
      ];
    },
    async browse() {
      const kept = await keptList();
      let current = kept;
      if (kept === undefined || now() - kept.fetchedAt > BROWSE_FRESH_MS) {
        try {
          current = await fetchList();
          list = current;
        } catch (error) {
          const reason = error instanceof FontSourceError ? error.reason : "unknown";
          // Offline, an older list still serves.
          if (kept === undefined) {
            console.error(`Webforge could not list the fonts to download (${reason})`);
            return { status: "failed", reason: reason === "offline" ? "offline" : "unknown" };
          }
        }
      }
      const known = await loaded();
      return {
        status: "listed",
        fonts: (current?.fonts ?? []).map(
          (font): BrowsableFont => ({
            ...font,
            installed: catalogueFont(font.id) !== undefined || known.has(font.id),
          }),
        ),
      };
    },
    async download(id) {
      const bundled = catalogueFont(id);
      if (bundled !== undefined)
        return { status: "downloaded", font: installed(bundled, "bundled") };
      const known = (await loaded()).get(id);
      // Downloaded before, with every file still as it was: nothing to fetch.
      if (known?.files.every((file) => reader.read(file) !== undefined)) {
        return { status: "downloaded", font: installed(known, "downloaded") };
      }
      const running = downloading.get(id);
      if (running !== undefined) return running;
      const started = download(id).finally(() => downloading.delete(id));
      downloading.set(id, started);
      return started;
    },
  };
}

/** Registers the `fonts` IPC calls (2.2) on `library`. */
export function registerFontHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  library: FontLibrary,
): void {
  registerIpcHandler(ipc, "listFonts", isTrustedSender, () => library.list());
  registerIpcHandler(ipc, "browseFonts", isTrustedSender, () => library.browse());
  registerIpcHandler(ipc, "downloadFont", isTrustedSender, (id) => library.download(id));
}
