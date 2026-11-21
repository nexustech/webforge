import type { CanvasEngine } from "@webforge/engine";
import { sameJson } from "@webforge/model";
import type { NavItem } from "@webforge/site-components";
import type { EditorSession } from "../editor/editor-session.js";
import { canvasNavigation } from "../editor/site-navigation.js";

type Unsubscribe = () => void;

/**
 * Shows the site's navigation in the Header on the canvas (F-ED-17), made as the export makes it,
 * for the page shown. The canvas is drawn again only when the navigation changes (an edit of the
 * menu or of the pages, or another page shown), not on every keystroke. Not a document change, so
 * no undo step.
 */
export function connectCanvasNavigation(
  engine: Pick<CanvasEngine, "setNavigation">,
  session: Pick<EditorSession, "history" | "ui">,
): Unsubscribe {
  const { document } = session.history;
  let shown: readonly NavItem[] | undefined;
  const show = () => {
    const items = canvasNavigation(document.getState(), session.ui.getState().pageId);
    if (items === undefined) return;
    if (shown === undefined || !sameJson(items, shown)) {
      shown = items;
      engine.setNavigation(items);
    }
  };
  show();
  const stopDocument = document.subscribe(show);
  const stopUi = session.ui.subscribe(show);
  return () => {
    stopDocument();
    stopUi();
  };
}
