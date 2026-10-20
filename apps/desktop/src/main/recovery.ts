import { dirname } from "node:path";
import { t } from "@webforge/i18n";
import type { ProjectResult } from "../shared/ipc-contract.js";
import type { BackupInfo, Backups } from "./backups.js";
import { type ProjectSession, samePath } from "./project-session.js";

/** What the user chose for a damaged site. */
export type RecoveryChoice = "latest" | "choose" | "cancel";

/** Native dialogs of the recovery flow, injected so it can be tested without Electron. */
export type RecoveryDialogs = {
  /** Explains that the site is damaged and asks what to do; `backups` is newest first. */
  ask(backups: readonly BackupInfo[]): Promise<RecoveryChoice>;
  /** Lets the user pick one of the backups in `folder`; `undefined` if they cancel. */
  chooseBackup(folder: string): Promise<string | undefined>;
  /** Says that there is no backup to restore. */
  noBackups(): Promise<void>;
};

/** The message box texts for a damaged site, with the latest backup's time. */
export function recoveryMessage(latest: BackupInfo, locale?: string) {
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    latest.takenAt,
  );
  return {
    title: t("storage.recovery.title"),
    message: t("storage.recovery.message"),
    detail: t("storage.recovery.detail", { when }),
    buttons: [
      t("storage.recovery.restoreLatest"),
      t("storage.recovery.chooseBackup"),
      t("storage.recovery.cancel"),
    ],
  };
}

/**
 * Opens the site at `path`, and if the file is damaged (ADR 0003: e.g. torn by a sync client)
 * offers its backups instead of failing: restore the latest, pick another, or leave it. The
 * damaged file is kept next to the restored one (see {@link Backups.restore}).
 */
export async function openOrRecover(
  session: Pick<ProjectSession, "open">,
  path: string,
  backups: Pick<Backups, "list" | "restore">,
  dialogs: RecoveryDialogs,
): Promise<ProjectResult> {
  const result = session.open(path);
  if (result.status !== "failed" || result.reason !== "corrupt") {
    return result;
  }
  const available = backups.list(path);
  const latest = available[0];
  if (latest === undefined) {
    await dialogs.noBackups();
    return result;
  }
  const choice = await dialogs.ask(available);
  let backup: string | undefined;
  if (choice === "latest") {
    backup = latest.path;
  } else if (choice === "choose") {
    const chosen = await dialogs.chooseBackup(dirname(latest.path));
    // Only one of this site's backups, never an arbitrary file, replaces the site.
    backup =
      chosen === undefined
        ? undefined
        : available.find((info) => samePath(info.path, chosen))?.path;
  }
  if (backup === undefined) {
    return result;
  }
  backups.restore(backup, path);
  return session.open(path);
}
