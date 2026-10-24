import type { Viewport } from "@webforge/engine";
import { useSyncExternalStore } from "react";
import type { EditorSession } from "../editor/editor-session.js";
import { fieldTarget } from "../editor/field-target.js";
import { pageListOf, samePages, useDocument, useUi } from "../editor/use-document.js";
import { CanvasToolbar } from "./CanvasToolbar.js";
import type { CanvasView } from "./canvas-view.js";
import { useContextualToolbar } from "./contextual-toolbar-context.js";
import { ElementToolbarRow } from "./ElementToolbarRow.js";
import { type PreferencesStore, usePreferences } from "./preferences-store.js";

/** The page list as the toolbar shows it, kept while only page content changes. */
const usePageList = (session: EditorSession) => useDocument(session, pageListOf, samePages);

/** The selected element's toolbar (SP-4), if its type has one and the mode allows it. */
function SelectedElementToolbar({
  session,
  preferences,
}: {
  readonly session: EditorSession;
  readonly preferences: PreferencesStore;
}) {
  const contentMode = usePreferences(preferences, (state) => state.mode !== "design");
  const pageId = useUi(session, (state) => state.pageId);
  const nodeId = useUi(session, (state) => state.nodeId);
  // Wherever it is: the page, the shared Header or Footer, a linked copy.
  const type = useDocument(
    session,
    (site) => fieldTarget(site, session.library, pageId, nodeId)?.node.type,
  );
  const toolbar = useContextualToolbar(type);
  if (toolbar === undefined || nodeId === null) return null;
  if (contentMode && toolbar.inContentMode !== true) return null;
  const Toolbar = toolbar.component;
  // Keyed by the element, so another element of the type starts afresh.
  return <Toolbar key={nodeId} nodeId={nodeId} />;
}

/**
 * The canvas toolbar on an editor session: it shows the session's page and view, and changes them
 * in its UI store, which undo restores but never records (U3, U6). Zoom and size live in the
 * window's {@link CanvasView}. Under it, the row for the selected element's toolbar (SP-4).
 */
export function CanvasToolbarHost({
  session,
  view,
  preferences,
}: {
  readonly session: EditorSession;
  /** The canvas's zoom and size, which the editor keeps in step with the canvas engine. */
  readonly view: CanvasView;
  /** The person's preferences: the View menu's options and their own devices, which it changes. */
  readonly preferences: PreferencesStore;
}) {
  const canvas = usePreferences(preferences, (state) => state.preferences.canvas);
  const zoom = useSyncExternalStore(view.subscribe, () => view.getState().zoom);
  const size = useSyncExternalStore(view.subscribe, () => view.getState().size);
  const pageId = useUi(session, (state) => state.pageId);
  const viewport = useUi(session, (state) => state.viewport);
  return (
    <>
      <CanvasToolbar
        pages={usePageList(session)}
        shownPageId={pageId}
        onShowPage={(id) => session.showPage(id)}
        viewport={viewport}
        onViewportChange={(next: Viewport) => session.setViewport(next)}
        zoom={zoom}
        onZoomChange={(next) => view.setState({ zoom: next })}
        size={size}
        canvas={canvas}
        onCanvasChange={(next) => preferences.change({ canvas: next })}
      />
      <ElementToolbarRow>
        <SelectedElementToolbar session={session} preferences={preferences} />
      </ElementToolbarRow>
    </>
  );
}
