import { t } from "@webforge/i18n";
import type { PageId, SiteDoc } from "@webforge/model";
import { useSyncExternalStore } from "react";
import { copySelection, reachOf } from "../shared-sections/shared-sections.js";
import type { EditorSession } from "./editor-session.js";
import { pagesShowing, sharedRegionOf, shownLayout } from "./shared-layout.js";

/** The banner's text while an element of a linked copy is selected, if it is (F-ED-23). */
function copyBanner(site: SiteDoc, pageId: PageId, nodeId: string | null): string | undefined {
  const selected = copySelection(site, pageId, nodeId);
  if (selected === undefined) return undefined;
  const name = t("history.namedItem", { name: selected.shared.name });
  const { copies, pages } = reachOf(site, selected.shared.id);
  const key = copies === 1 ? "one" : pages === 1 ? "onePage" : "pages";
  return t(`canvas.sharedSectionBanner.${key}`, { name, copies, pages });
}

/**
 * The banner over the canvas while an element of the shared Header or Footer is selected (F-ED-7,
 * D7): "Editing shared Footer: changes apply to all 6 pages", or of a linked copy of a shared
 * section (F-ED-23): "Editing shared section 'Opening hours': changes apply to 3 copies on 2
 * pages". Editing a shared region doesn't ask for confirmation on every change; this says, for as
 * long as it lasts, how far a change reaches.
 */
export function SharedRegionBanner({ session }: { readonly session: EditorSession }) {
  const { history, ui } = session;
  const site = useSyncExternalStore(history.document.subscribe, history.document.getState);
  const { pageId, nodeId } = useSyncExternalStore(ui.subscribe, ui.getState);
  const region = nodeId === null ? undefined : sharedRegionOf(shownLayout(site, pageId), nodeId);
  let text: string | undefined;
  if (region !== undefined) {
    const count = pagesShowing(site, region);
    const reach = count === 1 ? "one" : count === Object.keys(site.pages).length ? "all" : "some";
    text = t(`canvas.sharedBanner.${reach}`, { region: t(`canvas.sharedRegion.${region}`), count });
  } else {
    text = copyBanner(site, pageId, nodeId);
  }
  if (text === undefined) {
    return null;
  }
  return (
    <div
      role="status"
      className="border-border border-b bg-accent px-3 py-1.5 text-accent-foreground text-xs"
    >
      {text}
    </div>
  );
}
