import type { InsertPoint } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { isSharedCopy, type SharedSectionsDoc } from "@webforge/model";
import { useSyncExternalStore } from "react";
import { currentPage } from "../editor/editor-session.js";
import type { PanelRegistry } from "../shell/panels.js";
import { AddPanel, type AddPanelProps, type SharedSectionActions } from "./AddPanel.js";
import {
  type AddItem,
  type AddSession,
  type AddTab,
  addComponent,
  addItems,
  addSharedCopy,
  addTargetFor,
  sharedSectionItems,
} from "./add-items.js";

/** The Add panel's id in the panel registry. */
const ADD_PANEL_ID = "add";

/**
 * Where the canvas's + asked for a section: after the section with this id, or at the top of the
 * page (`null`). Kept by section, not by position, so it stays put while the page changes.
 */
type PointAfter = { readonly after: string | null };

/** What the panel shows besides the page: its tab, and the + button's place while it waits. */
type AddPanelState = { readonly tab: AddTab; readonly point: PointAfter | null };

/**
 * What the panel shows, which changes with its state, the page and the selection; kept (same
 * object) while it would look the same, e.g. while typing on the canvas.
 */
type AddView = {
  readonly tab: AddTab;
  /** The Sections tab: the site's shared sections first, then the library's sections. */
  readonly sections: readonly AddItem[];
  /** The + button's place, if its section is still on the page. */
  readonly point: InsertPoint | undefined;
  /** The section it follows, named; `null` at the top of the page. */
  readonly after: string | null;
  /** The types a click can add now, as `type,type`. */
  readonly addable: string;
};

/** The registered Add panel. */
export type AddPanelRegistration = {
  /** Shows the panel's Sections, ready to add one at `point` (the canvas's +, UI1). */
  openAt(point: InsertPoint): void;
  /** Removes the panel. */
  remove(): void;
};

/**
 * Adds the Add panel to the left column's top, first (UI1). Register it in Design mode only: it is
 * hidden in Content mode (M3). `flush` records the canvas's pending edits before each add;
 * `dragSource` (the canvas engine's `addDragSource`) lets the items be dragged onto the canvas;
 * `sharedActions` give the shared sections listed their Rename and Delete (1.29).
 */
export function registerAddPanel(
  panels: PanelRegistry,
  session: AddSession,
  {
    flush = () => undefined,
    dragSource,
    sharedActions,
  }: {
    readonly flush?: () => void;
    readonly dragSource?: AddPanelProps["dragSource"];
    readonly sharedActions?: SharedSectionActions;
  } = {},
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

  const content = () => currentPage(session)?.doc.content ?? [];
  /** Where the + button's place is now, or `undefined` once its section has gone. */
  const insertPoint = (point: PointAfter | null): InsertPoint | undefined => {
    if (point === null) return undefined;
    if (point.after === null) return { index: 0 };
    const index = content().findIndex((node) => node.props.id === point.after);
    return index === -1 ? undefined : { index: index + 1 };
  };
  /** The name of the section `id`, as undo labels name it; a copy by its shared section's name. */
  const nameOf = (id: string): string | null => {
    const node = content().find((candidate) => candidate.props.id === id);
    if (node === undefined) return null;
    const shared = history.document.getState().sharedSections;
    const name =
      node.props.layerName?.trim() ||
      (isSharedCopy(node) && Object.hasOwn(shared, node.props.sharedSectionId)
        ? shared[node.props.sharedSectionId]?.name
        : undefined);
    return name
      ? t("history.namedItem", { name })
      : (library.components[node.type]?.label ?? node.type);
  };
  // The Sections tab's items, rebuilt only when the site's shared sections change.
  let listed: { shared: SharedSectionsDoc | undefined; items: readonly AddItem[] } = {
    shared: undefined,
    items: sections,
  };
  const sectionItems = (): readonly AddItem[] => {
    const shared = history.document.getState().sharedSections;
    if (shared !== listed.shared) {
      listed = { shared, items: [...sharedSectionItems(history.document.getState()), ...sections] };
    }
    return listed.items;
  };

  let view: AddView | undefined;
  const getView = (): AddView => {
    const point = insertPoint(state.point);
    const after = state.point?.after ?? null;
    const shownSections = sectionItems();
    const next: AddView = {
      tab: state.tab,
      sections: shownSections,
      point,
      after: after === null ? null : nameOf(after),
      addable: [...shownSections, ...elements]
        .filter((item) =>
          // A shared section goes wherever a section does: anywhere on a page.
          item.sharedSectionId !== undefined
            ? currentPage(session) !== undefined
            : addTargetFor(session, item.type, point) !== undefined,
        )
        .map((item) => item.type)
        .join(","),
    };
    if (
      view === undefined ||
      view.tab !== next.tab ||
      view.sections !== next.sections ||
      view.point?.index !== next.point?.index ||
      view.after !== next.after ||
      view.addable !== next.addable
    ) {
      view = next;
    }
    return view;
  };
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

  function Add() {
    const shown = useSyncExternalStore(subscribe, getView, getView);
    const addable = new Set(shown.addable.split(","));
    return (
      <AddPanel
        sections={shown.sections}
        elements={elements}
        tab={shown.tab}
        onTabChange={(tab) => setState({ tab })}
        onAdd={(type) => {
          flush();
          const at = insertPoint(state.point);
          const shared = shown.sections.find((item) => item.type === type)?.sharedSectionId;
          const added =
            shared === undefined
              ? addComponent(session, type, at)
              : addSharedCopy(session, shared, at);
          if (added) setState({ point: null });
        }}
        canAdd={(type) => addable.has(type)}
        point={shown.point === undefined ? null : { after: shown.after }}
        onCancelPoint={() => setState({ point: null })}
        dragSource={dragSource}
        sharedActions={sharedActions}
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
      const before = content()[point.index - 1];
      setState({ tab: "sections", point: { after: before?.props.id ?? null } });
      panels.show(ADD_PANEL_ID);
    },
    remove() {
      stopPageWatch();
      remove();
    },
  };
}
