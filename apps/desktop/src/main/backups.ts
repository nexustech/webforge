import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
} from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import type { ProjectStore, StoredFormats } from "@webforge/storage";
import { appEvents } from "../shared/ipc/app.js";

/**
 * A site's file kept as an older Webforge wrote it, before this one first wrote it in a newer
 * format (#1525, UC-2): `userData/backups/<projectId>/before-update-format-<n>-site-<m>.wforge`,
 * one for each site, by its id, so a moved or renamed file keeps it. Never pruned with the rolling
 * backups. Its formats, as the older Webforge wrote them, say which versions open it.
 */
export type KeptCopy = StoredFormats & {
  readonly path: string;
  /** When it was kept. */
  readonly keptAt: Date;
  /** Its size, in bytes. */
  readonly size: number;
};

/** The file couldn't be kept as it was, so the write that would change its format is refused. */
export class KeepCopyError extends Error {
  constructor(cause: unknown) {
    super("Webforge could not keep the site's file as it was before the update", { cause });
    this.name = "KeepCopyError";
  }
}

/**
 * `before-update-3f2a9c41b07e-format-2-site-22.wforge`: the kept copy, by the site file's path (a
 * short key of it) and the formats it holds. A file copied in Explorer or Finder keeps its site's
 * id, so the path keeps each copy's own (#1525).
 */
const KEPT_NAME = /^before-update-([0-9a-f]{12})-format-(\d+)-site-(\d+)\.wforge$/;

/** The short key of a site file's path that a kept copy is named by. */
function keptKey(sitePath: string): string {
  return pathKey(sitePath).slice(0, 12);
}

/** A backup of a site, newest first in {@link Backups.list}. */
export type BackupInfo = {
  readonly path: string;
  /** When it was taken. */
  readonly takenAt: Date;
};

/** Options of {@link createBackups}. */
export type BackupOptions = {
  /** `userData/backups`: one folder per site below it. */
  readonly root: string;
  /** How many backups to keep per site (F-SITE-6: "last N"). */
  readonly keep?: number;
  readonly now?: () => Date;
};

const KEEP = 5;
/** `20261020-153000-123.wforge`: UTC, sortable, safe on every file system. */
const BACKUP_NAME = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-(\d{3})\.wforge$/;
/** A backup that never finished (the app was killed while writing it). */
const UNFINISHED = /\.tmp$/;
const UNFINISHED_AGE_MS = 60 * 60 * 1_000;

/**
 * The folder name for a site file: a hash of its path, so a damaged file finds its backups
 * without being opened, and no path (which can name the user) is stored.
 */
function pathKey(path: string): string {
  const full = resolve(path);
  // Windows and macOS paths are case-insensitive; one site must not get two backup folders.
  const normalised = process.platform === "linux" ? full : full.toLowerCase();
  return createHash("sha256").update(normalised).digest("hex").slice(0, 32);
}

function backupName(date: Date): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}-` +
    `${pad(date.getUTCMilliseconds(), 3)}.wforge`
  );
}

function takenAt(name: string): Date | undefined {
  const match = BACKUP_NAME.exec(name);
  if (match === null) {
    return undefined;
  }
  const [, year, month, day, hours, minutes, seconds, ms] = match.map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day, hours, minutes, seconds, ms));
}

/** The finished backups of one folder, newest first. */
function backupsIn(folder: string): BackupInfo[] {
  if (!existsSync(folder)) {
    return [];
  }
  return readdirSync(folder)
    .flatMap((name): BackupInfo[] => {
      const date = takenAt(name);
      return date === undefined ? [] : [{ path: join(folder, name), takenAt: date }];
    })
    .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
}

/**
 * Rolling backups of open sites (F-SITE-6, 06 "Backups"): copies taken with SQLite's online backup
 * API into `userData/backups/<projectId>/<path key>/`, the last 5 kept per site file. Copies of a
 * `.wforge` share its project id, so the path key keeps each copy's backups apart. They are the
 * way back when a site file is damaged, e.g. torn by a sync client mid-save (ADR 0003 §4).
 */
export function createBackups(options: BackupOptions) {
  const keep = options.keep ?? KEEP;
  const now = options.now ?? (() => new Date());

  return {
    /** Backs up the open site at `sourcePath`, then deletes all but its newest backups. */
    async take(store: ProjectStore, sourcePath: string): Promise<BackupInfo> {
      const folder = join(options.root, store.info.projectId, pathKey(sourcePath));
      mkdirSync(folder, { recursive: true });
      let date = now();
      // Two backups in the same millisecond (tests, a quick reopen) get distinct names.
      while (existsSync(join(folder, backupName(date)))) {
        date = new Date(date.getTime() + 1);
      }
      const path = join(folder, backupName(date));
      await store.backupTo(path);
      for (const old of backupsIn(folder).slice(keep)) {
        rmSync(old.path, { force: true });
      }
      for (const name of readdirSync(folder).filter((entry) => UNFINISHED.test(entry))) {
        const leftover = join(folder, name);
        if (date.getTime() - statSync(leftover).mtimeMs > UNFINISHED_AGE_MS) {
          rmSync(leftover, { force: true });
        }
      }
      return { path, takenAt: date };
    },

    /**
     * The backups of the site file at `sourcePath`, newest first, found without opening it. A
     * moved or renamed site finds none; its backups are still in the backups folder.
     */
    list(sourcePath: string): BackupInfo[] {
      if (!existsSync(options.root)) {
        return [];
      }
      const key = pathKey(sourcePath);
      return readdirSync(options.root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .flatMap((entry) => backupsIn(join(options.root, entry.name, key)))
        .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
    },

    /**
     * Keeps the site file at `sourcePath` as it is now, byte for byte, as the copy from before an
     * update (#1525), replacing the site's earlier one. Called before the first write that changes
     * the file's format, with the file whole between transactions. Copied under a temporary name
     * and renamed, so a failed copy leaves the earlier one. Throws {@link KeepCopyError} on failure:
     * the write must not happen without it.
     */
    keepBeforeUpdate(sourcePath: string, projectId: string, formats: StoredFormats): KeptCopy {
      const { fileFormat, siteFormat } = formats;
      const folder = join(options.root, projectId);
      const key = keptKey(sourcePath);
      const name = `before-update-${key}-format-${fileFormat}-site-${siteFormat}.wforge`;
      const path = join(folder, name);
      const incoming = `${path}.tmp`;
      try {
        mkdirSync(folder, { recursive: true });
        // On main, synchronously, as the write waits for it anyway: a 400 MB site file took
        // 113 ms on CI's Windows runner and 257–345 ms on its macOS one (#1525's follow-up).
        // Once per site file and format change, so not worth a thread.
        copyFileSync(sourcePath, incoming);
        // Stamped when it was kept: a copy keeps the site file's own time on Windows and macOS.
        const keptAt = now();
        utimesSync(incoming, keptAt, keptAt);
        renameSync(incoming, path);
        // This file's earlier copy goes; a copy of the same site under another path stays.
        for (const other of readdirSync(folder)) {
          if (other !== name && KEPT_NAME.exec(other)?.[1] === key) {
            rmSync(join(folder, other), { force: true });
          }
        }
        return { path, fileFormat, siteFormat, keptAt, size: statSync(path).size };
      } catch (error) {
        // A copy cut short by a full disk is no use, and takes the room it needs.
        rmSync(incoming, { force: true });
        throw new KeepCopyError(error);
      }
    },

    /**
     * The copy kept from before an update of the site with `projectId`, open at `sitePath`, if
     * there is one: the copy of that file, or else the site's newest, for a file moved or renamed
     * since its copy was kept.
     */
    keptBeforeUpdate(projectId: string, sitePath: string): KeptCopy | undefined {
      const folder = join(options.root, projectId);
      if (!existsSync(folder)) return undefined;
      const key = keptKey(sitePath);
      const kept = readdirSync(folder).flatMap((name): (KeptCopy & { key: string })[] => {
        const match = KEPT_NAME.exec(name);
        if (match === null) return [];
        const path = join(folder, name);
        const info = statSync(path);
        return [
          {
            key: match[1] ?? "",
            path,
            fileFormat: Number(match[2]),
            siteFormat: Number(match[3]),
            keptAt: info.mtime,
            size: info.size,
          },
        ];
      });
      const newest = kept.sort((a, b) => b.keptAt.getTime() - a.keptAt.getTime());
      const found = newest.find((copy) => copy.key === key) ?? newest[0];
      if (found === undefined) return undefined;
      const { key: _key, ...copy } = found;
      return copy;
    },

    /**
     * Puts `backup` in place of the damaged site file at `sitePath`. The damaged file is kept
     * next to it as `<name> (damaged <date>).wforge`, never deleted, so nothing is lost if the
     * backup turns out older than hoped. The backup is copied under a temporary name first, so a
     * failed copy leaves the damaged file where it was. Returns the damaged copy's path.
     */
    restore(backup: string, sitePath: string): string {
      const extension = extname(sitePath);
      const stamp = backupName(now()).replace(/\.wforge$/, "");
      const damaged = join(
        dirname(sitePath),
        `${basename(sitePath, extension)} (damaged ${stamp})${extension}`,
      );
      const incoming = join(dirname(sitePath), `.${basename(sitePath)}.restoring.tmp`);
      try {
        copyFileSync(backup, incoming);
      } catch (error) {
        rmSync(incoming, { force: true });
        throw error;
      }
      if (existsSync(sitePath)) {
        renameSync(sitePath, damaged);
      }
      renameSync(incoming, sitePath);
      return damaged;
    },
  };
}

/** See {@link createBackups}. */
export type Backups = ReturnType<typeof createBackups>;

/**
 * The copy kept of a site before an update changes its format, and saving it (#1525, UC-2): the
 * session's hook, which keeps the file and tells the window so it can offer to save it, and what
 * the site's calls find it with, with the running version that names its releases.
 */
export function createKeptCopies(
  backups: Backups,
  version: string,
  window: () => { readonly webContents: { send(channel: string): void } } | undefined,
) {
  return {
    backups,
    version,
    beforeFormatChange: (
      path: string,
      kept: { readonly projectId: string } & StoredFormats,
    ): void => {
      backups.keepBeforeUpdate(path, kept.projectId, kept);
      // The window offers to save it, once the change that waited for it is saved.
      window()?.webContents.send(appEvents.copyKept.channel);
    },
  };
}
