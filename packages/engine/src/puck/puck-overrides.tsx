import { createUsePuck, type Overrides, useGetPuck } from "@puckeditor/core";
import type { ComponentLibrary } from "@webforge/site-components";
import { type ReactNode, useEffect } from "react";
import type { ElementRequest, FieldDrag, InsertPoint } from "../canvas-engine.js";
import { createActionBar } from "./action-bar.js";
import type { CanvasFrame } from "./canvas-frame.js";
import { type FrameListenerOptions, listenInFrame } from "./canvas-listeners.js";
import type { CanvasPage } from "./canvas-page.js";
import type { CanvasSelection } from "./canvas-selection.js";
import type { CanvasSync } from "./canvas-sync.js";
import type { CanvasView } from "./canvas-view.js";
import { applyChromeStyles, createSelectionOutline } from "./chrome.js";
import type { DragSources } from "./drag-sources.js";
import type { Emitter } from "./engine-support.js";
import { CANVAS_ROOT } from "./puck-dom.js";
import { boxHandleFields } from "./spacing-handles.js";

type GetPuck = ReturnType<typeof useGetPuck>;

const usePuck = createUsePuck();

/** What {@link createPuckOverrides} connects Puck's parts to. */
export type PuckOverridesOptions = {
  readonly sync: CanvasSync;
  readonly view: CanvasView;
  readonly page: CanvasPage;
  readonly selection: CanvasSelection;
  readonly frame: CanvasFrame;
  /** Puck's getter while Puck is mounted, `null` once it goes. */
  readonly setPuck: (get: GetPuck | null) => void;
  /** The element the canvas is mounted in. */
  readonly host: () => HTMLElement | null;
  readonly library: () => ComponentLibrary | null;
  /** The Add panel's drag sources, portalled from inside Puck. */
  readonly dragSources: DragSources;
  /** What the canvas document's keys, clicks and menus report to (see `listenInFrame`). */
  readonly frameListeners: FrameListenerOptions;
  /** The canvas iframe's window as it comes and goes. */
  readonly frameWindows: Emitter<Window | null>;
  /** The floating + asks to add an element at a place in the page's own content. */
  readonly addRequest: (at: InsertPoint) => void;
  /** The quick actions ask for an image to be picked or an element hidden or shown. */
  readonly elementRequest: (request: ElementRequest) => void;
  /** A spacing handle is dragged (1.32). */
  readonly fieldDrag: (drag: FieldDrag) => void;
};

/**
 * The parts of Puck the canvas replaces (ADR 0004): its header (with its own Undo and Redo), the
 * component overlay (the selection chrome, 1.12), the quick actions, and two wrappers: the Bridge
 * inside Puck, which connects the engine to Puck's store, and the canvas iframe's, which shows the
 * editor's state in its document and listens there.
 */
export function createPuckOverrides(options: PuckOverridesOptions): Partial<Overrides> {
  const { sync, view, page, selection, frame } = options;

  function Bridge({ children }: { children: ReactNode }) {
    const get = useGetPuck();
    // Some selections bypass onAction (Puck's inline text field selects through an internal
    // helper), so watch the selected item too.
    const selectedId = usePuck((state) => state.selectedItem?.props.id ?? null);
    useEffect(() => selection.report(selectedId), [selectedId]);
    const width = usePuck((state) => state.appState.ui.viewports.current.width);
    useEffect(() => {
      options.setPuck(get);
      if (!sync.isShown()) {
        page.show();
      }
      // A width set before Puck was ready, or Puck's own starting width.
      view.show();
      // A selection made before Puck was ready. Only when it differs: re-selecting resets Puck's
      // field focus and remounts an open rich-text editor (this effect re-runs on re-renders).
      if ((get().selectedItem?.props.id ?? null) !== selection.current()) {
        selection.show();
      }
      return () => {
        options.setPuck(null);
        view.forgetPending();
        // A remounted Puck starts from whatever `data` it was last rendered with: resend the page.
        sync.forget();
      };
    }, [get]);
    // After the effect above, so the width it sends to Puck isn't taken for the user's choice.
    useEffect(() => {
      view.shown(width);
      view.measure();
    }, [width]);
    // Puck changes the zoom inside its store, where nothing reports it, and shows it on the canvas
    // root's style (its scale and height): watch that.
    useEffect(() => {
      const canvasRoot = options.host()?.querySelector(CANVAS_ROOT);
      if (!canvasRoot) {
        return;
      }
      view.measure();
      const observer = new MutationObserver(view.measure);
      observer.observe(canvasRoot, { attributes: true, attributeFilter: ["style"] });
      return () => {
        observer.disconnect();
        view.stopMeasuring();
      };
    }, []);
    return (
      <>
        {children}
        <options.dragSources.Portals />
      </>
    );
  }

  function CanvasFrame({ children, document }: { children: ReactNode; document?: Document }) {
    useEffect(() => {
      // In the editor's colours, following its theme (see `applyChromeStyles`), then the site's.
      const stopColours =
        document === undefined
          ? undefined
          : applyChromeStyles(document, options.host()?.ownerDocument ?? document);
      frame.attach(document);
      if (document !== undefined) selection.outlineOthers(document);
      const frameWindow = document?.defaultView;
      if (!frameWindow) {
        return stopColours;
      }
      options.frameWindows.emit(frameWindow);
      const stopListening = listenInFrame(frameWindow, options.frameListeners);
      return () => {
        stopListening();
        stopColours?.();
        frame.detach();
        options.frameWindows.emit(null);
      };
    }, [document]);
    return <>{children}</>;
  }

  return {
    // Replaces Puck's header, which holds Puck's own Undo/Redo buttons.
    header: () => <></>,
    puck: Bridge,
    iframe: CanvasFrame,
    // Selection chrome (1.12): magenta outlines and the selected element's quick actions.
    componentOverlay: createSelectionOutline(
      (at) => {
        // The floating + counts the Header's nodes; the app adds to the page's own content.
        const { page: shown, layout } = page.docs();
        options.addRequest({
          index: Math.min(Math.max(at.index - layout.header.length, 0), shown.content.length),
        });
      },
      {
        fieldsOf: (componentType) => boxHandleFields(options.library(), componentType),
        onFieldDrag: options.fieldDrag,
      },
    ),
    // The quick actions, for the page as it is now (see `action-bar.tsx`).
    actionBar: createActionBar({
      docs: page.docs,
      library: options.library,
      document: () => frame.document() ?? options.host()?.ownerDocument,
      request: options.elementRequest,
      several: selection.several,
    }),
  };
}
