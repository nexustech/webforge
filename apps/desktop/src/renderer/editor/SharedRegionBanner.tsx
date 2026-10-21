import { t } from "@webforge/i18n";
import { useSyncExternalStore } from "react";
import type { EditorSession } from "./editor-session.js";
import { pagesShowing, sharedRegionOf, shownLayout } from "./shared-layout.js";

/**
 * The banner over the canvas while an element of the shared Header or Footer is selected (F-ED-7,
 * D7): "Editing shared Footer: changes apply to all 6 pages". Editing a shared region doesn't ask
 * for confirmation on every change; this says, for as long as it lasts, how far a change reaches.
 */
export function SharedRegionBanner({ session }: { readonly session: EditorSession }) {
  const { history, ui } = session;
  const site = useSyncExternalStore(history.document.subscribe, history.document.getState);
  const { pageId, nodeId } = useSyncExternalStore(ui.subscribe, ui.getState);
  const region = nodeId === null ? undefined : sharedRegionOf(shownLayout(site, pageId), nodeId);
  if (region === undefined) {
    return null;
  }
  const count = pagesShowing(site, region);
  const reach = count === 1 ? "one" : count === Object.keys(site.pages).length ? "all" : "some";
  return (
    <div
      role="status"
      className="border-border border-b bg-accent px-3 py-1.5 text-accent-foreground text-xs"
    >
      {t(`canvas.sharedBanner.${reach}`, {
        region: t(`canvas.sharedRegion.${region}`),
        count,
      })}
    </div>
  );
}
