import { t } from "@webforge/i18n";
import type { PageId, SiteDoc } from "@webforge/model";
import { useSyncExternalStore } from "react";
import { copySelection, reachOf } from "../shared-sections/shared-sections.js";
import type { EditorSession } from "./editor-session.js";
import { pagesShowing, sharedRegionOf, shownLayout } from "./shared-layout.js";
import { useDocument, useUi } from "./use-document.js";

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
/** What the banner says for the element `nodeId` of page `pageId`, if it's in a shared place. */
function bannerText(site: SiteDoc, pageId: PageId, nodeId: string | null): string | undefined {
  const region = nodeId === null ? undefined : sharedRegionOf(shownLayout(site, pageId), nodeId);
  if (region === undefined) return copyBanner(site, pageId, nodeId);
  const count = pagesShowing(site, region);
  const reach = count === 1 ? "one" : count === Object.keys(site.pages).length ? "all" : "some";
  return t(`canvas.sharedBanner.${reach}`, { region: t(`canvas.sharedRegion.${region}`), count });
}

export function SharedRegionBanner({ session }: { readonly session: EditorSession }) {
  const pageId = useUi(session, (ui) => ui.pageId);
  const nodeId = useUi(session, (ui) => ui.nodeId);
  // The banner's text is its slice: it redraws only when what it says changes (R9).
  const text = useDocument(session, (site) => bannerText(site, pageId, nodeId));
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
