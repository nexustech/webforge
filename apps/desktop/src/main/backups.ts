import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import type { ProjectStore } from "@webforge/storage";
import { z } from "zod";

/** A backup of a site, newest first in {@link Backups.list}. */
export type BackupInfo = {
  readonly path: string;
  /** When it was taken. */
  readonly takenAt: Date;
};

/** Options of {@link createBackups}. */
export type BackupOptions = {
  /** `userData/backups`: one folder per site (project id) below it. */
  readonly root: string;
  /** How many backups to keep per site (F-SITE-6: "last N"). */
  readonly keep?: number;
  readonly now?: () => Date;
};

const KEEP = 5;
const SOURCE_FILE = "source.json";
/** `20261020-153000-123.wforge`: UTC, sortable, safe on every file system. */
const BACKUP_NAME = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-(\d{3})\.wforge$/;

/**
 * Which site file a backup folder belongs to: a hash of its path, so a damaged file can find its
 * backups without opening it, and no path (which can name the user) is stored.
 */
const sourceSchema = z.strictObject({ pathHash: z.string().regex(/^[0-9a-f]{64}$/) });

function pathHash(path: string): string {
  const full = resolve(path);
  // Windows and macOS paths are case-insensitive; one site must not get two backup folders.
  const normalised = process.platform === "linux" ? full : full.toLowerCase();
  return createHash("sha256").update(normalised).digest("hex");
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

/** The backups of one folder, newest first. */
function backupsIn(folder: string): BackupInfo[] {
  return readdirSync(folder)
    .flatMap((name): BackupInfo[] => {
      const date = takenAt(name);
      return date === undefined ? [] : [{ path: join(folder, name), takenAt: date }];
    })
    .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
}

/**
 * Rolling backups of open sites (F-SITE-6, 06 "Backups"): copies taken with SQLite's online backup
 * API into `userData/backups/<projectId>/`, the last 5 kept per site. They are the way back when a
 * site file is damaged, e.g. torn by a sync client mid-save (ADR 0003 §4).
 */
export function createBackups(options: BackupOptions) {
  const keep = options.keep ?? KEEP;
  const now = options.now ?? (() => new Date());

  return {
    /** Backs up the open site at `sourcePath`, then deletes all but its newest backups. */
    async take(store: ProjectStore, sourcePath: string): Promise<BackupInfo> {
      const folder = join(options.root, store.info.projectId);
      mkdirSync(folder, { recursive: true });
      writeFileSync(
        join(folder, SOURCE_FILE),
        JSON.stringify({ pathHash: pathHash(sourcePath) } satisfies z.infer<typeof sourceSchema>),
      );
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
      const hash = pathHash(sourcePath);
      return readdirSync(options.root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .flatMap((entry) => {
          const folder = join(options.root, entry.name);
          try {
            const source = sourceSchema.parse(
              JSON.parse(readFileSync(join(folder, SOURCE_FILE), "utf8")),
            );
            return source.pathHash === hash ? backupsIn(folder) : [];
          } catch {
            return [];
          }
        })
        .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
    },

    /**
     * Puts `backup` in place of the damaged site file at `sitePath`. The damaged file is kept
     * next to it as `<name> (damaged <date>).wforge`, never deleted, so nothing is lost if the
     * backup turns out older than hoped. Returns the damaged copy's path.
     */
    restore(backup: string, sitePath: string): string {
      const extension = extname(sitePath);
      const stamp = backupName(now()).replace(/\.wforge$/, "");
      const damaged = join(
        dirname(sitePath),
        `${basename(sitePath, extension)} (damaged ${stamp})${extension}`,
      );
      if (existsSync(sitePath)) {
        renameSync(sitePath, damaged);
      }
      copyFileSync(backup, sitePath);
      return damaged;
    },
  };
}

/** See {@link createBackups}. */
export type Backups = ReturnType<typeof createBackups>;
