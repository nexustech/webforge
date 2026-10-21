import { t } from "@webforge/i18n";
import type { ProjectFailureReason, ProjectResult } from "../../shared/ipc-contract.js";

/** What the user is told when a site can't be opened or created. */
export function openFailureMessage(reason: ProjectFailureReason): string {
  switch (reason) {
    case "not-a-project":
      return t("site.openFailed.notASite");
    case "corrupt":
    case "unexpected-schema":
      return t("site.openFailed.damaged");
    case "newer-format":
      return t("site.openFailed.newer");
    case "not-found":
      return t("site.openFailed.missing");
    case "unknown":
      return t("site.openFailed.unknown");
  }
}

/**
 * Runs a create or open request (the main process shows the dialog and saves the open site first)
 * and, once another site is open, starts the window over with it: `restart` reloads the renderer,
 * which reads the new site as at start-up. Returns the message to show for a failure, or
 * `undefined` when the site opened or the user cancelled.
 */
export async function openSiteWith(
  request: () => Promise<ProjectResult>,
  restart: () => void = () => window.location.reload(),
): Promise<string | undefined> {
  let result: ProjectResult;
  try {
    result = await request();
  } catch {
    return t("site.openFailed.unknown");
  }
  if (result.status === "opened") {
    restart();
    return undefined;
  }
  return result.status === "failed" ? openFailureMessage(result.reason) : undefined;
}
