import type { CanvasEngine } from "@webforge/engine";
import { t } from "@webforge/i18n";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";
import type { EditorSession } from "./editor-session.js";
import { pagesShowing, type SharedRegion, sharedRegionOf } from "./shared-layout.js";

type Session = Pick<EditorSession, "history" | "ui" | "library">;
type Confirm = Pick<SiteWideConfirm, "confirmSiteWide">;

/** Asks whether to remove `item` from the shared `region`, and every page showing it (D7). */
function confirmShared(
  session: Session,
  siteWide: Confirm,
  how: "delete" | "cut",
  item: string,
  region: SharedRegion,
): Promise<boolean> {
  const where = { item, region: t(`canvas.sharedRegion.${region}`) };
  return siteWide.confirmSiteWide({
    action: t(how === "delete" ? "canvas.sharedDelete.title" : "canvas.sharedCut.title", where),
    confirm: how === "delete" ? t("canvas.delete") : t("edit.cut"),
    affectedPages: pagesShowing(session.history.document.getState(), region),
  });
}

/**
 * The canvas `engine` as the editor session sees it, with removals from the shared Header or
 * Footer held back until the person confirms them (F-ED-7, D7): the quick action, the Delete key,
 * the Edit menu and Layers all report one this way. Confirmed, the removal is recorded as usual,
 * one undo step; cancelled, the canvas is put back as the document still is.
 */
export function confirmSharedRemovals(
  engine: CanvasEngine,
  session: Session,
  siteWide: Confirm,
): CanvasEngine {
  return {
    ...engine,
    onUserEdit: (listener) =>
      engine.onUserEdit((edit) => {
        const site = session.history.document.getState();
        const region =
          edit.kind === "remove" && edit.shared === true && edit.nodeId !== null
            ? sharedRegionOf(site.layout, edit.nodeId)
            : undefined;
        if (region === undefined) {
          listener(edit);
          return;
        }
        const type = edit.componentType ?? "";
        const item = session.library.components[type]?.label ?? type;
        void confirmShared(session, siteWide, "delete", item, region).then((confirmed) => {
          if (confirmed) {
            listener(edit);
            return;
          }
          const now = session.history.document.getState();
          const page = now.pages[session.ui.getState().pageId]?.doc;
          if (page !== undefined) engine.applyChange({ page, layout: now.layout });
        });
      }),
  };
}

/** What Cut asks before removing an element from the shared Header or Footer (F-ED-7, D7). */
export function sharedCutConfirmation(
  session: Session,
  siteWide: Confirm,
): (item: string, region: SharedRegion) => Promise<boolean> {
  return (item, region) => confirmShared(session, siteWide, "cut", item, region);
}
