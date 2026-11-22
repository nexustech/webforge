import { writeFile } from "node:fs/promises";
import type { UpdateChannel } from "../shared/update-channel.js";
import type { AppFeature } from "./app-feature.js";
import type { AppElectron } from "./app-parts.js";
import type { CrashReports } from "./crash-reports.js";
import { type DiagnosticsParts, registerDiagnosticsHandlers } from "./diagnostics-ipc.js";
import type { NativeDialogs } from "./dialogs.js";
import { registerIpcHandler } from "./ipc.js";
import { logFailure } from "./log.js";
import { startupTimes } from "./startup-timing.js";
import { recordUsage, setUsageSink, type UsageEvent } from "./usage.js";
import type { UsageSummary } from "./usage-summary.js";

/** The most events kept while the summary loads: a start-up's, and some to spare. */
const WAITING_MAX = 500;

/**
 * The usage summary as a feature (5.40, BD-1): what the editor tells it (`app:record-usage`), a
 * site's first edit after it opens, the start-up's time once the window is there, and its last
 * write before Webforge exits. Everything the main process records reaches it from now on: kept
 * until `make` gives the summary, which waits for the window, so main's start-up loads none of it
 * (#892).
 */
export function usageFeature(
  make: () => Promise<UsageSummary>,
  startupMs: () => number | undefined,
  diagnostics?: Omit<DiagnosticsParts, "summary">,
): AppFeature {
  const waiting: UsageEvent[] = [];
  let summary: UsageSummary | undefined;
  let made: Promise<UsageSummary | undefined> | undefined;
  setUsageSink((event) => {
    if (summary !== undefined) summary.record(event);
    else if (waiting.length < WAITING_MAX) waiting.push(event);
  });
  // Counted once for each opening of a site: the first change saved after it opened.
  let edited = true;
  return {
    register: (ipc, isTrustedSender) => {
      registerIpcHandler(ipc, "recordUsage", isTrustedSender, (usage) => {
        recordUsage(usage);
        return null;
      });
      // Help › Diagnostics… (5.41, BD-2): the summary once it has loaded.
      if (diagnostics !== undefined) {
        registerDiagnosticsHandlers(ipc, isTrustedSender, {
          ...diagnostics,
          summary: async () => (made === undefined ? undefined : made),
        });
      }
    },
    started: () => {
      const ms = startupMs();
      if (ms !== undefined) recordUsage({ kind: "startup", ms });
      made = make()
        .then(async (loaded) => {
          summary = loaded;
          for (const event of waiting.splice(0)) loaded.record(event);
          await loaded.start();
          return loaded;
        })
        .catch((error: unknown) => {
          logFailure("Webforge could not read the usage summary", error);
          return undefined;
        });
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
    quit: async () => {
      await (await made)?.idle();
    },
  };
}

/**
 * The usage summary of this Webforge, in its user data beside the crash reports, as a feature:
 * the computer it runs on described in numbers and listed names, the update channel the person
 * chose (`chosen`), and how many crash reports the folder holds.
 */
export function usageFeatureFor(
  { app, screen, shell }: Pick<AppElectron, "app" | "screen" | "shell">,
  crashReports: Pick<CrashReports, "count" | "newest">,
  dialogs: Pick<NativeDialogs, "diagnostics">,
  /** The app's lifecycle: the update channel the person chose, in their preferences. */
  lifecycle: {
    readonly preferences:
      | { get(): { readonly updateChannel?: UpdateChannel | undefined } }
      | undefined;
  },
): AppFeature {
  const chosen = () => lifecycle.preferences?.get().updateChannel;
  return usageFeature(
    async () => {
      const [{ release, totalmem }, { updateChannelFor }, usage] = await Promise.all([
        import("node:os"),
        import("../shared/update-channel.js"),
        import("./usage-summary.js"),
      ]);
      const { listedOr, versionNumbers } = usage;
      return usage.createUsageSummary({
        dir: app.getPath("userData"),
        lists: usage.loadUsageLists,
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
    },
    () => startupTimes()["window-created"],
    {
      crashReports: (most) => crashReports.newest(most),
      // The user data, beside the crash reports' own folder, which holds the summary.
      folder: app.getPath("userData"),
      openPath: (path) => shell.openPath(path),
      chooseFile: () => dialogs.diagnostics.chooseReportToSave(),
      writeFile: (path, text) => writeFile(path, text),
    },
  );
}
