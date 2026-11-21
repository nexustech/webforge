import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useEffect, useState } from "react";
import type { ClipboardApi } from "../../shared/ipc/clipboard.js";
import type { McpApi } from "../../shared/ipc/mcp.js";
import { useCommandRegistry } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { AiAppsDialog } from "./AiAppsDialog.js";

/** Props of {@link AiAppsCommand}. */
type AiAppsCommandProps = {
  readonly mcp: McpApi;
  readonly clipboard: Pick<ClipboardApi, "copyText" | "copySecret">;
};

/**
 * AI apps (F-AI-1, 4.9) on the start screen (#1244): File › AI apps… and its dialog, as the editor
 * has them, so an app can be connected before any site exists, ahead of asking it for one (4.12a).
 * Settings' AI apps line runs the same command.
 */
export function AiAppsCommand({ mcp, clipboard }: AiAppsCommandProps) {
  const registry = useCommandRegistry();
  const [open, setOpen] = useState(false);
  useEffect(
    () =>
      registry.register({
        id: COMMAND_IDS.aiApps,
        label: t("aiApps.command"),
        menu: "file",
        run: () => setOpen(true),
      }),
    [registry],
  );
  return (
    <AiAppsDialog
      open={open}
      mcp={mcp}
      copyText={(text) => clipboard.copyText(text)}
      copySecret={(secret) => clipboard.copySecret(secret)}
      notify={(message) => toast.error(message)}
      onClose={() => setOpen(false)}
    />
  );
}
