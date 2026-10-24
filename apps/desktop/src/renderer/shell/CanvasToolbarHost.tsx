import type { Viewport } from "@webforge/engine";
import { useSyncExternalStore } from "react";
import type { CanvasPreferences } from "../../shared/ipc/prefs.js";
import type { EditorSession } from "../editor/editor-session.js";
import { pageListOf, useDocument, useUi } from "../editor/use-document.js";
import { CanvasToolbar } from "./CanvasToolbar.js";
import type { CanvasView } from "./canvas-view.js";

/** The page list as the toolbar shows it, kept while only page content changes. */
const usePageList = (session: EditorSession) => useDocument(session, pageListOf);

/**
 * The canvas toolbar on an editor session: it shows the session's page and view, and changes them
 * in its UI store, which undo restores but never records (U3, U6). Zoom and size live in the
 * window's {@link CanvasView}.
 */
export function CanvasToolbarHost({
  session,
  view,
  canvas,
  onCanvasChange,
}: {
  readonly session: EditorSession;
  /** The canvas's zoom and size, which the editor keeps in step with the canvas engine. */
  readonly view: CanvasView;
  /** The View menu's options and the person's own devices, from their preferences. */
  readonly canvas: CanvasPreferences;
  readonly onCanvasChange: (canvas: CanvasPreferences) => void;
}) {
  const zoom = useSyncExternalStore(view.subscribe, () => view.getState().zoom);
  const size = useSyncExternalStore(view.subscribe, () => view.getState().size);
  const pageId = useUi(session, (state) => state.pageId);
  const viewport = useUi(session, (state) => state.viewport);
  return (
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
      onCanvasChange={onCanvasChange}
    />
  );
}
