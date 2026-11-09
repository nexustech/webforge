import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { UpdateStatus } from "../../shared/ipc/updates.js";

/** One notice at a time, however often it's said. */
const TOAST_ID = "update-ready";
/** Long enough to read a sentence, then it goes: nothing waits on it. */
const SHOWN_MS = 10_000;

/**
 * The quiet notice that Webforge's update has downloaded (0.5a): "{appName} 1.2.0 is ready: it
 * installs when you close {appName}." Nothing to click, as nothing needs doing.
 */
export function showUpdateReady(version: string): void {
  toast.info(t("updates.ready", { version }), { id: TOAST_ID, duration: SHOWN_MS });
}

/**
 * Calls `show` with the version of an update that has downloaded, once per version, from each
 * status it's given.
 */
export function updateReadyNotices(
  show: (version: string) => void,
): (status: UpdateStatus) => void {
  let told: string | undefined;
  return (status) => {
    if (status.state !== "downloaded" || status.version === undefined) return;
    if (status.version === told) return;
    told = status.version;
    show(status.version);
  };
}
