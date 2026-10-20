import {
  buildCrashReport,
  type CrashContext,
  type CrashProcess,
  type CrashReports,
} from "./crash-reports.js";

/** `render-process-gone` / `child-process-gone` details, as Electron reports them. */
type GoneDetails = { readonly reason: string; readonly exitCode: number; readonly type?: string };

/** The Electron and Node objects the handlers attach to; fakes in tests. */
export type CrashSources = {
  readonly process: {
    on(
      event: "uncaughtException" | "unhandledRejection",
      listener: (error: unknown) => void,
    ): unknown;
  };
  readonly app: {
    on(
      event: "render-process-gone",
      listener: (event: unknown, contents: unknown, details: GoneDetails) => void,
    ): unknown;
    on(
      event: "child-process-gone",
      listener: (event: unknown, details: GoneDetails) => void,
    ): unknown;
  };
  /** Electron's `crashReporter`: native crashes become minidumps in `crashDumps`. */
  readonly crashReporter: { start(options: { uploadToServer: boolean; compress: boolean }): void };
};

/** Electron's child process types, as the report names them. */
function processOf(type: string | undefined): CrashProcess {
  if (type === "GPU") return "gpu";
  if (type === "Utility") return "utility";
  return "other";
}

/**
 * Routes every crash and uncaught error to a local report (F-SITE-7, standards §10). Nothing is
 * ever uploaded: `crashReporter` keeps its minidumps on disk (`uploadToServer: false`) and no
 * other code sends a report anywhere. After an uncaught exception in the main process, which
 * leaves it in an unknown state, `onFatal` ends the app.
 */
export function installCrashHandlers(
  sources: CrashSources,
  reports: Pick<CrashReports, "write">,
  context: CrashContext,
  onFatal: () => void,
): void {
  sources.crashReporter.start({ uploadToServer: false, compress: true });

  const write = (details: Parameters<typeof buildCrashReport>[1]) => {
    try {
      reports.write(buildCrashReport(context, details));
    } catch {
      // A report that can't be written (disk full) must not cause a second crash.
    }
  };

  sources.process.on("uncaughtException", (error) => {
    write({ process: "main", kind: "uncaught-exception", error });
    onFatal();
  });
  sources.process.on("unhandledRejection", (error) => {
    write({ process: "main", kind: "unhandled-rejection", error });
  });
  sources.app.on("render-process-gone", (_event, _contents, details) => {
    if (details.reason !== "clean-exit") {
      write({ process: "renderer", kind: details.reason, exitCode: details.exitCode });
    }
  });
  sources.app.on("child-process-gone", (_event, details) => {
    if (details.reason !== "clean-exit") {
      write({ process: processOf(details.type), kind: details.reason, exitCode: details.exitCode });
    }
  });
}

/**
 * The next-launch notice (F-SITE-7): if Webforge crashed since the user was last told, say so
 * (autosave means the work up to the last few seconds is in the file) and offer the folder.
 * `ask` shows the message box and resolves true for "Open crash reports folder".
 */
export async function noticeAfterCrash(
  reports: Pick<CrashReports, "hasUnseen" | "markSeen">,
  ask: () => Promise<boolean>,
  openFolder: () => Promise<void>,
): Promise<void> {
  if (!reports.hasUnseen()) {
    return;
  }
  reports.markSeen();
  if (await ask()) {
    await openFolder();
  }
}
