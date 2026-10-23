import type { InsertPoint } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { isSharedCopy, type SharedSectionsDoc } from "@webforge/model";
import { SquarePlusIcon } from "lucide-react";
import { type ReactNode, useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";
import { type AddPreferences, MAX_FAVOURITES, MAX_RECENT } from "../../shared/ipc/prefs.js";
import { currentPage } from "../editor/editor-session.js";
import type { CommandRegistry } from "../shell/commands.js";
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
  withFavourites,
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
  /** The Sections tab: favourites, recently used, the shared sections, then the library's. */
  readonly sections: readonly AddItem[];
  /** The Elements tab: favourites, recently used, then the library's. */
  readonly elements: readonly AddItem[];
  /** The + button's place, if its section is still on the page. */
  readonly point: InsertPoint | undefined;
  /** The section it follows, named; `null` at the top of the page. */
  readonly after: string | null;
  /** The types a click can add now, as `type,type`. */
  readonly addable: string;
  readonly favourites: readonly string[];
};

/** The registered Add panel. */
export type AddPanelRegistration = {
  /** Shows the panel's Sections, ready to add one at `point` (the canvas's +, UI1). */
  openAt(point: InsertPoint): void;
  /** Removes the panel. */
  remove(): void;
};

/** What registering the Add panel takes besides the panels and the session. */
type AddPanelOptions = {
  /** Records the canvas's pending edits before each add. */
  readonly flush?: () => void;
  /** The canvas engine's `addDragSource`: lets the items be dragged onto the canvas. */
  readonly dragSource?: AddPanelProps["dragSource"];
  /** Rename and Delete for the shared sections listed (1.29). */
  readonly sharedActions?: SharedSectionActions;
  /** The person's favourites and recently added items (1.34, F-ED-26), saved in preferences. */
  readonly preferences?: StoreApi<AddPreferences>;
  /** The command palette, which gets an *Add ‹item›* command for each item (UX-11). */
  readonly commands?: CommandRegistry;
  /** A section's larger preview, shown on hover or focus (UX-10). */
  readonly preview?: (item: AddItem) => ReactNode;
};

/**
 * Adds the Add panel to the left column's top, first (UI1). Register it in Design mode only: it is
 * hidden in Content mode (M3), and so are the palette's Add commands it contributes.
 */
export function registerAddPanel(
  panels: PanelRegistry,
  session: AddSession,
  {
    flush = () => undefined,
    dragSource,
    sharedActions,
    preferences,
    commands,
    preview,
  }: AddPanelOptions = {},
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
  const noPreferences: AddPreferences = { favourites: [], recent: [] };
  const prefs = () => preferences?.getState() ?? noPreferences;
  // Both tabs' items, rebuilt only when the shared sections or the favourites change.
  let listed:
    | {
        readonly shared: SharedSectionsDoc;
        readonly prefs: AddPreferences;
        readonly sections: readonly AddItem[];
        readonly elements: readonly AddItem[];
      }
    | undefined;
  const items = () => {
    const shared = history.document.getState().sharedSections;
    const current = prefs();
    if (listed?.shared !== shared || listed.prefs !== current) {
      const { favourites, recent } = current;
      const all = [...sharedSectionItems(history.document.getState()), ...sections];
      listed = {
        shared,
        prefs: current,
        sections: withFavourites(all, favourites, recent),
        elements: withFavourites(elements, favourites, recent),
      };
    }
    return listed;
  };
  /** Whether a click on `item` has somewhere to add it now (at the + button's place, if any). */
  const canAdd = (item: AddItem, point?: InsertPoint) =>
    // A shared section goes wherever a section does: anywhere on a page.
    item.sharedSectionId !== undefined
      ? currentPage(session) !== undefined
      : addTargetFor(session, item.type, point) !== undefined;

  let view: AddView | undefined;
  const getView = (): AddView => {
    const point = insertPoint(state.point);
    const after = state.point?.after ?? null;
    const shown = items();
    const next: AddView = {
      tab: state.tab,
      sections: shown.sections,
      elements: shown.elements,
      point,
      after: after === null ? null : nameOf(after),
      addable: [...shown.sections, ...shown.elements]
        .filter((item) => canAdd(item, point))
        .map((item) => item.type)
        .join(","),
      favourites: prefs().favourites,
    };
    if (
      view === undefined ||
      view.tab !== next.tab ||
      view.sections !== next.sections ||
      view.elements !== next.elements ||
      view.point?.index !== next.point?.index ||
      view.after !== next.after ||
      view.addable !== next.addable ||
      view.favourites !== next.favourites
    ) {
      view = next;
    }
    return view;
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const stopDocument = history.document.subscribe(listener);
    const stopUi = ui.subscribe(listener);
    const stopPreferences = preferences?.subscribe(listener);
    return () => {
      listeners.delete(listener);
      stopDocument();
      stopUi();
      stopPreferences?.();
    };
  };

  /** Adds `item` (at `point`, if given) as one step, and remembers it as recently used. */
  const add = (item: AddItem, point?: InsertPoint): boolean => {
    flush();
    const added =
      item.sharedSectionId === undefined
        ? addComponent(session, item.type, point)
        : addSharedCopy(session, item.sharedSectionId, point);
    if (added && preferences !== undefined) {
      const { favourites, recent } = preferences.getState();
      const next = [item.type, ...recent.filter((key) => key !== item.type)];
      preferences.setState({ favourites, recent: next.slice(0, MAX_RECENT) }, true);
    }
    return added;
  };
  const toggleFavourite = (type: string) => {
    if (preferences === undefined) return;
    const { favourites, recent } = preferences.getState();
    const next = favourites.includes(type)
      ? favourites.filter((key) => key !== type)
      : [...favourites, type].slice(-MAX_FAVOURITES);
    preferences.setState({ favourites: next, recent }, true);
  };

  function Add() {
    const shown = useSyncExternalStore(subscribe, getView, getView);
    const addable = new Set(shown.addable.split(","));
    const favourites = new Set(shown.favourites);
    return (
      <AddPanel
        sections={shown.sections}
        elements={shown.elements}
        tab={shown.tab}
        onTabChange={(tab) => setState({ tab })}
        onAdd={(type) => {
          const item = [...shown.sections, ...shown.elements].find((each) => each.type === type);
          if (item !== undefined && add(item, insertPoint(state.point))) setState({ point: null });
        }}
        canAdd={(type) => addable.has(type)}
        point={shown.point === undefined ? null : { after: shown.after }}
        onCancelPoint={() => setState({ point: null })}
        dragSource={dragSource}
        sharedActions={sharedActions}
        favourites={
          preferences === undefined
            ? undefined
            : { has: (type) => favourites.has(type), toggle: toggleFavourite }
        }
        preview={preview}
      />
    );
  }

  const stopPalette =
    commands === undefined ? () => undefined : registerAddCommands(commands, items, canAdd, add);

  const remove = panels.register({
    id: ADD_PANEL_ID,
    slot: "left.top",
    title: t("add.title"),
    icon: SquarePlusIcon,
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
      stopPalette();
      stopPageWatch();
      remove();
    },
  };

  /**
   * The command palette's *Add* group (UX-11): *Add ‹item›* for every section and element, and
   * *Add a copy of ‹name›* for every shared section, each adding where a click in the panel would
   * (after the selection's section or at the end of the page; an element into the selection's
   * section). One with nowhere to go is off. Kept in step with the shared sections and the page.
   */
  function registerAddCommands(
    registry: CommandRegistry,
    list: () => { readonly sections: readonly AddItem[]; readonly elements: readonly AddItem[] },
    isAddable: (item: AddItem) => boolean,
    addItem: (item: AddItem) => boolean,
  ): () => void {
    const registered = new Map<
      string,
      { readonly remove: () => void; enabled: boolean; label: string }
    >();
    const sync = () => {
      const { sections: shownSections, elements: shownElements } = list();
      // Each item once: not again for its place among the favourites or recently used.
      const unique = new Map<string, AddItem>();
      for (const item of [...shownSections, ...shownElements]) {
        if (!unique.has(item.type)) unique.set(item.type, item);
      }
      for (const [type, entry] of registered) {
        if (!unique.has(type)) {
          entry.remove();
          registered.delete(type);
        }
      }
      for (const [type, item] of unique) {
        const enabled = isAddable(item);
        const entry = registered.get(type);
        const id = `add.item.${type}`;
        // A shared section's name can change; a component's never does.
        const label =
          item.sharedSectionId === undefined
            ? t("add.palette.add", { item: item.label })
            : t("add.palette.addCopy", { name: t("history.namedItem", { name: item.label }) });
        if (entry === undefined) {
          const removeCommand = registry.register({
            id,
            label,
            palette: "add",
            keywords: [item.category],
            enabled,
            run: () => {
              addItem(item);
            },
          });
          registered.set(type, { remove: removeCommand, enabled, label });
        } else if (entry.enabled !== enabled || entry.label !== label) {
          entry.enabled = enabled;
          entry.label = label;
          registry.update(id, { enabled, label });
        }
      }
    };
    sync();
    const stops = [
      history.document.subscribe(sync),
      ui.subscribe(sync),
      preferences?.subscribe(sync) ?? (() => undefined),
    ];
    return () => {
      for (const stop of stops) stop();
      for (const entry of registered.values()) entry.remove();
    };
  }
}
