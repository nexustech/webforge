import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { z } from "zod";

/** How many sites the start screen lists, besides those pinned, which stay however many there are. */
const MAX_SITES = 12;

const entrySchema = z.strictObject({
  /** A hash of the path: the renderer refers to a site by it and never sees or sends paths. */
  id: z.string().regex(/^[0-9a-f]{32}$/),
  path: z.string().min(1),
  name: z.string().min(1),
  lastOpened: z.iso.datetime(),
  lastEdited: z.iso.datetime().nullable(),
  /** Kept at the top of the start screen (2.14b, LF-10). A list from before pinning reads as none. */
  pinned: z.boolean().default(false),
});

const fileSchema = z.strictObject({ version: z.literal(1), sites: z.array(entrySchema) });

type Entry = z.infer<typeof entrySchema>;

/** A site on the start screen's Recent list. */
export type RecentSite = {
  readonly id: string;
  readonly name: string;
  /** The file's name, e.g. `Rosa's Bakery.wforge`; the full path stays in the main process. */
  readonly fileName: string;
  /** The name of the folder the file is in, e.g. `Documents` (2.14b). */
  readonly folder: string;
  readonly lastOpened: string;
  readonly lastEdited: string | null;
  /** A JPEG data URL of the canvas when the site was last closed, if there is one. */
  readonly thumbnail: string | null;
  /** The file is no longer where it was (moved, deleted, on a disconnected drive). */
  readonly missing: boolean;
  /** Kept at the top of the list (2.14b). */
  readonly pinned: boolean;
};

/**
 * `sites`, most recently opened first, without the oldest unpinned ones past `max`: pinned sites
 * stay, however many there are.
 */
function capped(sites: readonly Entry[], max: number): Entry[] {
  let unpinned = 0;
  return sites.filter((site) => site.pinned || unpinned++ < max);
}

/** The id of a site file: stable for one path, case-insensitive on Windows and macOS. */
export function recentSiteId(path: string): string {
  const full = resolve(path);
  const normalised = process.platform === "linux" ? full : full.toLowerCase();
  return createHash("sha256").update(normalised).digest("hex").slice(0, 32);
}

/**
 * The start screen's Recent list (F-SITE-2): `userData/recent.json` plus thumbnails in
 * `userData/recent-thumbnails/<id>.jpg`. It lives only on this computer, next to the user's
 * preferences; nothing of it is logged. A damaged or unknown file just means an empty list.
 */
export function createRecentSites(options: {
  readonly dir: string;
  readonly now?: () => Date;
  readonly max?: number;
}) {
  const now = options.now ?? (() => new Date());
  const max = options.max ?? MAX_SITES;
  const file = join(options.dir, "recent.json");
  const thumbnails = join(options.dir, "recent-thumbnails");
  const thumbnailPath = (id: string) => join(thumbnails, `${id}.jpg`);
  /** When each site's edit time was last written, so most saves don't even read the file. */
  const editWritten = new Map<string, number>();

  const read = (): Entry[] => {
    try {
      return fileSchema.parse(JSON.parse(readFileSync(file, "utf8"))).sites;
    } catch {
      return [];
    }
  };

  const write = (sites: readonly Entry[]) => {
    mkdirSync(options.dir, { recursive: true });
    // Write and rename, so a crash never leaves half a list.
    const temp = `${file}.tmp`;
    writeFileSync(temp, JSON.stringify({ version: 1, sites }, null, 2));
    renameSync(temp, file);
    // Thumbnails of sites no longer listed go too.
    if (existsSync(thumbnails)) {
      const kept = new Set(sites.map((site) => `${site.id}.jpg`));
      for (const name of readdirSync(thumbnails).filter((entry) => !kept.has(entry))) {
        rmSync(join(thumbnails, name), { force: true });
      }
    }
  };

  const update = (path: string, change: (entry: Entry | undefined) => Entry | undefined) => {
    const id = recentSiteId(path);
    const sites = read();
    const existing = sites.find((site) => site.id === id);
    const next = change(existing);
    if (next === undefined) {
      return;
    }
    write(capped([next, ...sites.filter((site) => site.id !== id)], max));
  };

  return {
    /** Puts a site at the top of the list as just opened (or created). */
    opened(path: string, name: string): void {
      update(path, (existing) => ({
        id: recentSiteId(path),
        path: resolve(path),
        name,
        lastOpened: now().toISOString(),
        lastEdited: existing?.lastEdited ?? null,
        pinned: existing?.pinned ?? false,
      }));
    },

    /** Records that the open site was saved; written at most once a minute per site. */
    edited(path: string): void {
      const time = now();
      const id = recentSiteId(path);
      if (time.getTime() - (editWritten.get(id) ?? Number.NEGATIVE_INFINITY) < 60_000) {
        return;
      }
      update(path, (existing) => {
        if (existing === undefined) return undefined;
        const last = existing.lastEdited === null ? 0 : Date.parse(existing.lastEdited);
        if (time.getTime() - last < 60_000) return undefined;
        editWritten.set(id, time.getTime());
        return { ...existing, lastEdited: time.toISOString() };
      });
    },

    /** Stores the canvas thumbnail of a listed site. */
    saveThumbnail(path: string, jpeg: Uint8Array): void {
      const id = recentSiteId(path);
      if (!read().some((site) => site.id === id)) return;
      mkdirSync(thumbnails, { recursive: true });
      writeFileSync(thumbnailPath(id), jpeg);
    },

    /** The list: pinned sites first, then the rest, each most recently opened first. */
    list(): RecentSite[] {
      const sites = read();
      const ordered = [
        ...sites.filter((site) => site.pinned),
        ...sites.filter((site) => !site.pinned),
      ];
      return ordered.map((site) => {
        const thumbnail = thumbnailPath(site.id);
        return {
          id: site.id,
          name: site.name,
          fileName: basename(site.path),
          folder: basename(dirname(site.path)),
          lastOpened: site.lastOpened,
          lastEdited: site.lastEdited,
          thumbnail: existsSync(thumbnail)
            ? `data:image/jpeg;base64,${readFileSync(thumbnail).toString("base64")}`
            : null,
          missing: !existsSync(site.path),
          pinned: site.pinned,
        };
      });
    },

    /** The path of a listed site, for opening it; `undefined` for an unknown id. */
    pathOf(id: string): string | undefined {
      return read().find((site) => site.id === id)?.path;
    },

    /** Pins a listed site to the top of the list, or unpins it (2.14b). */
    setPinned(id: string, pinned: boolean): void {
      const sites = read();
      if (sites.some((site) => site.id === id && site.pinned !== pinned)) {
        write(sites.map((site) => (site.id === id ? { ...site, pinned } : site)));
      }
    },

    /** Takes a site off the list (its file is untouched). */
    remove(id: string): void {
      const sites = read();
      if (sites.some((site) => site.id === id)) {
        write(sites.filter((site) => site.id !== id));
      }
    },
  };
}

/** See {@link createRecentSites}. */
export type RecentSites = ReturnType<typeof createRecentSites>;
