import type { AppFeature } from "./app-feature.js";
import { registerIpcHandler } from "./ipc.js";
import { logFailure } from "./log.js";
import { recordUsage, setUsageSink } from "./usage.js";
import type { UsageSummary } from "./usage-summary.js";

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
