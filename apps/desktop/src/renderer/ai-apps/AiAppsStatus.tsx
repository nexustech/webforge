import { Button } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { BotIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { McpApi, McpStatus } from "../../shared/ipc/mcp.js";

/** How often the title bar asks whether an AI app is connected. */
export const INDICATOR_EVERY_MS = 5_000;

export type AiAppsStatusProps = {
  readonly mcp: Pick<McpApi, "status">;
  /** Opens AI apps. */
  readonly onOpen: () => void;
};

/**
 * The title bar's sign that an AI app is connected (F-AI-1, 4.9): nothing while none is; while one
 * is, its name, and a click opens AI apps, where it can be removed.
 */
export function AiAppsStatus({ mcp, onOpen }: AiAppsStatusProps) {
  const [connected, setConnected] = useState<readonly string[]>([]);
  useEffect(() => {
    let live = true;
    const refresh = () => {
      mcp.status().then(
        // None known (a test's fake answers nothing): nothing connected.
        (status: McpStatus | undefined) => {
          const apps = status?.apps ?? [];
          if (live) setConnected(apps.filter((app) => app.connected).map((app) => app.name));
        },
        // Not known now: nothing is shown until it is.
        () => undefined,
      );
    };
    refresh();
    const timer = setInterval(refresh, INDICATOR_EVERY_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [mcp]);
  if (connected.length === 0) return null;
  const label = t("aiApps.indicator", { names: connected.join(", ") });
  return (
    <Button variant="ghost" size="sm" aria-label={label} title={label} onClick={onOpen}>
      <BotIcon className="text-primary" aria-hidden />
    </Button>
  );
}
