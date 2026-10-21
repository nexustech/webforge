import type { InsertPoint } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { useSyncExternalStore } from "react";
import type { PanelRegistry } from "../shell/panels.js";
import { AddPanel } from "./AddPanel.js";
import {
  type AddSession,
  type AddTab,
  addComponent,
  addItems,
  addTargetFor,
  shownContent,
} from "./add-items.js";

/** The Add panel's id in the panel registry. */
const ADD_PANEL_ID = "add";

/** What the panel shows besides the page: its tab, and the + button's place while it waits. */
type AddPanelState = { readonly tab: AddTab; readonly point: InsertPoint | null };

/** The registered Add panel. */
export type AddPanelRegistration = {
  /** Shows the panel's Sections, ready to add one at `point` (the canvas's +, UI1). */
  openAt(point: InsertPoint): void;
  /** Removes the panel. */
  remove(): void;
};

/**
 * Adds the Add panel to the left column's top, first (UI1). Register it in Design mode only: it is
 * hidden in Content mode (M3). `flush` records the canvas's pending edits before each add.
 */
export function registerAddPanel(
  panels: PanelRegistry,
  session: AddSession,
  flush: () => void = () => undefined,
): AddPanelRegistration {
  const { history, ui, library } = session;
  const sections = addItems(library, "sections");
  const elements = addItems(library, "elements");
  let state: AddPanelState = { tab: "sections", point: null };
  const listeners = new Set<() => void>();
  const setState = (next: Partial<AddPanelState>) => {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  };
  // The + button's place belongs to the page it was clicked on.
  let pageId = ui.getState().pageId;
  const stopPageWatch = ui.subscribe((current) => {
    if (current.pageId !== pageId) {
      pageId = current.pageId;
      setState({ point: null });
    }
  });

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const stopDocument = history.document.subscribe(listener);
    const stopUi = ui.subscribe(listener);
    return () => {
      listeners.delete(listener);
      stopDocument();
      stopUi();
    };
  };
  // Changes with the panel's state, the page and the selection, which decide where adding goes.
  let snapshot = { state, document: history.document.getState(), ui: ui.getState() };
  const getSnapshot = () => {
    const document = history.document.getState();
    const current = ui.getState();
    if (snapshot.state !== state || snapshot.document !== document || snapshot.ui !== current) {
      snapshot = { state, document, ui: current };
    }
    return snapshot;
  };

  /** The name of the section before `point`, or `null` at the top of the page. */
  const sectionBefore = (point: InsertPoint): string | null => {
    const node = shownContent(session)[point.index - 1];
    if (node === undefined) return null;
    const name = node.props.layerName?.trim();
    return name
      ? t("history.namedItem", { name })
      : (library.components[node.type]?.label ?? node.type);
  };

  function Add() {
    const { state: shown } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const point = shown.point ?? undefined;
    return (
      <AddPanel
        sections={sections}
        elements={elements}
        tab={shown.tab}
        onTabChange={(tab) => setState({ tab })}
        onAdd={(type) => {
          flush();
          if (addComponent(session, type, point)) setState({ point: null });
        }}
        canAdd={(type) => addTargetFor(session, type, point) !== undefined}
        point={point === undefined ? null : { after: sectionBefore(point) }}
        onCancelPoint={() => setState({ point: null })}
      />
    );
  }

  const remove = panels.register({
    id: ADD_PANEL_ID,
    slot: "left.top",
    title: t("add.title"),
    order: -1,
    component: Add,
  });
  return {
    openAt(point) {
      setState({ tab: "sections", point });
      panels.show(ADD_PANEL_ID);
    },
    remove() {
      stopPageWatch();
      remove();
    },
  };
}
