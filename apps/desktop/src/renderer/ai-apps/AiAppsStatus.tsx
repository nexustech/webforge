import { Button } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { BotIcon, ZapIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { McpApi, McpStatus } from "../../shared/ipc/mcp.js";

/** How often the title bar asks whether an AI app is connected. */
export const INDICATOR_EVERY_MS = 5_000;

export type AiAppsStatusProps = {
  readonly mcp: Pick<McpApi, "status">;
  /** Opens AI apps. */
  readonly onOpen: () => void;
  readonly now?: () => number;
};

/** The apps connected, and those working without asking on the open site, by name. */
type Shown = { readonly connected: readonly string[]; readonly unasked: readonly string[] };

/** What `status` shows at `at`, and when an app working without asking stops, if one is. */
function shownOf(status: McpStatus | undefined, at: number): Shown & { readonly ends?: number } {
  const apps = status?.apps ?? [];
  const working = apps.filter((app) => app.unaskedUntil !== null && app.unaskedUntil > at);
  const ends = Math.min(...working.map((app) => app.unaskedUntil ?? Number.POSITIVE_INFINITY));
  return {
    connected: apps.filter((app) => app.connected).map((app) => app.name),
    unasked: working.map((app) => app.name),
    ...(Number.isFinite(ends) ? { ends } : {}),
  };
}

/**
 * The title bar's sign that an AI app is connected (F-AI-1, 4.9): nothing while none is; while one
 * is, its name, and a click opens AI apps, where it can be removed. While an app works without
 * asking on the open site (5.35, UA-2), its icon and its name say so, until that ends.
 */
export function AiAppsStatus({ mcp, onOpen, now = Date.now }: AiAppsStatusProps) {
  const [shown, setShown] = useState<Shown>({ connected: [], unasked: [] });
  useEffect(() => {
    let live = true;
    let ending: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      mcp.status().then(
        // None known (a test's fake answers nothing): nothing connected.
        (status: McpStatus | undefined) => {
          if (!live) return;
          const { ends, ...next } = shownOf(status, now());
          setShown(next);
          // Shown no longer than it lasts: looked at again the moment it ends.
          clearTimeout(ending);
          ending = ends === undefined ? undefined : setTimeout(refresh, ends - now());
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
      clearTimeout(ending);
    };
  }, [mcp, now]);
  const { connected, unasked } = shown;
  if (connected.length === 0 && unasked.length === 0) return null;
  const label =
    unasked.length > 0
      ? t("aiApps.indicatorUnasked", { names: unasked.join(", ") })
      : t("aiApps.indicator", { names: connected.join(", ") });
  return (
    <Button variant="ghost" size="sm" aria-label={label} tooltip={label} onClick={onOpen}>
      {unasked.length > 0 ? (
        <ZapIcon className="text-warning" aria-hidden />
      ) : (
        <BotIcon className="text-primary" aria-hidden />
      )}
    </Button>
  );
}
