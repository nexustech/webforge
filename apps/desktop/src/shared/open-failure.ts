import { t } from "@webforge/i18n";
import type { ProjectFailureReason } from "./ipc-contract.js";

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
