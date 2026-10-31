import { t } from "@webforge/i18n";
import type { AppApi } from "../../shared/ipc/app.js";
import type { CommandRegistry } from "../shell/commands.js";

const OPEN_CRASH_REPORTS_ID = "help.openCrashReports";

/**
 * Registers Help → Open Crash Reports Folder (F-SITE-7): reports stay on the user's computer, and
 * this is how they find one to share with support if they choose to. Returns the unregister.
 */
export function registerCrashReportsCommand(
  registry: CommandRegistry,
  app: Pick<AppApi, "openCrashReports">,
): () => void {
  return registry.register({
    id: OPEN_CRASH_REPORTS_ID,
    label: t("storage.command.openCrashReports"),
    menu: "help",
    run: async () => {
      await app.openCrashReports();
    },
  });
}
