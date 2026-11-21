import { release, totalmem } from "node:os";
import { type UpdateChannel, updateChannelFor } from "../shared/update-channel.js";
import type { AppFeature } from "./app-feature.js";
import type { AppElectron } from "./app-parts.js";
import { registerIpcHandler } from "./ipc.js";
import { logFailure } from "./log.js";
import { startupTimes } from "./startup-timing.js";
import { recordUsage, setUsageSink } from "./usage.js";
import {
  createUsageSummary,
  listedOr,
  loadUsageLists,
  type UsageSummary,
  versionNumbers,
} from "./usage-summary.js";

/**
 * The usage summary as a feature (5.40, BD-1): what the editor tells it (`app:record-usage`), a
 * site's first edit after it opens, the start-up's time once the window is there, and its last
 * write before Webforge exits. Everything the main process records reaches it from now on.
 */
export function usageFeature(
  summary: UsageSummary,
  startupMs: () => number | undefined,
): AppFeature {
  setUsageSink((event) => summary.record(event));
  // Counted once for each opening of a site: the first change saved after it opened.
  let edited = true;
  return {
    register: (ipc, isTrustedSender) => {
      registerIpcHandler(ipc, "recordUsage", isTrustedSender, (usage) => {
        recordUsage(usage);
        return null;
      });
    },
    started: () => {
      const ms = startupMs();
      if (ms !== undefined) recordUsage({ kind: "startup", ms });
      // Its lists come with the site's code, after the window has opened (#892).
      void summary
        .start()
        .catch((error: unknown) => logFailure("Webforge could not read the usage summary", error));
    },
    site: {
      opened: () => {
        edited = false;
      },
      committed: () => {
        if (edited) return;
        edited = true;
        recordUsage({ kind: "firstEdit" });
      },
    },
    quit: () => summary.idle(),
  };
}

/**
 * The usage summary of this Webforge, in its user data beside the crash reports, as a feature:
 * the computer it runs on described in numbers and listed names, the update channel the person
 * chose (`chosen`), and how many crash reports the folder holds.
 */
export function usageFeatureFor(
  { app, screen }: Pick<AppElectron, "app" | "screen">,
  crashReports: { count(): number },
  chosen: () => UpdateChannel | undefined,
): AppFeature {
  const summary = createUsageSummary({
    dir: app.getPath("userData"),
    lists: loadUsageLists,
    crashReports: () => crashReports.count(),
    computer: () => ({
      version: versionNumbers(app.getVersion()),
      channel: updateChannelFor(chosen(), app.getVersion()),
      platform: listedOr(["win32", "darwin", "linux"], process.platform),
      arch: listedOr(["x64", "arm64"], process.arch),
      osVersion: versionNumbers(release()),
      memoryGb: Math.round(totalmem() / 1024 ** 3),
      scale: screen.getAllDisplays()[0]?.scaleFactor ?? 1,
      language: "en",
    }),
  });
  return usageFeature(summary, () => startupTimes()["window-created"]);
}
