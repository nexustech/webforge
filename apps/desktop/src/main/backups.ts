import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import type { ProjectStore } from "@webforge/storage";

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
