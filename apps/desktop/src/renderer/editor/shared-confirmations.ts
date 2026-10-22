import type { CanvasEngine } from "@webforge/engine";
import { t } from "@webforge/i18n";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";
import type { EditorSession } from "./editor-session.js";
import { removeNode } from "./nodes.js";
import { pagesShowing, type SharedRegion, sharedRegionOf, shownLayout } from "./shared-layout.js";

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
 * one undo step, against the document as it is then; cancelled, the canvas is put back as the
 * document still is. While a question is open, undo and redo from the canvas do nothing.
 */
export function confirmSharedRemovals(
  engine: CanvasEngine,
  session: Session,
  siteWide: Pick<SiteWideConfirm, "confirmSiteWide" | "current">,
): CanvasEngine {
  return {
    ...engine,
    onHistoryCommand: (listener) =>
      engine.onHistoryCommand((command) =>
        siteWide.current() === null ? listener(command) : false,
      ),
    onUserEdit: (listener) =>
      engine.onUserEdit((edit) => {
        const site = session.history.document.getState();
        const nodeId = edit.kind === "remove" && edit.shared === true ? edit.nodeId : null;
        const region = nodeId === null ? undefined : sharedRegionOf(site.layout, nodeId);
        if (nodeId === null || region === undefined) {
          listener(edit);
          return;
        }
        const type = edit.componentType ?? "";
        const item = session.library.components[type]?.label ?? type;
        void confirmShared(session, siteWide, "delete", item, region).then((confirmed) => {
          const now = session.history.document.getState();
          if (confirmed) {
            // The removal itself, from the layout as it is now: nothing else the canvas held
            // when it was asked for comes back.
            const layout = { ...now.layout, [region]: structuredClone(now.layout[region]) };
            removeNode(layout[region], nodeId);
            listener({ ...edit, layout });
            return;
          }
          const pageId = session.ui.getState().pageId;
          const page = now.pages[pageId]?.doc;
          if (page !== undefined) engine.applyChange({ page, layout: shownLayout(now, pageId) });
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
