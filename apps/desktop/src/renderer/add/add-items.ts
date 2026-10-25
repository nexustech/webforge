import type { InsertPoint } from "@webforge/engine";
import { t } from "@webforge/i18n";
import {
  copiedNodeId,
  copyHolding,
  isNodeDoc,
  type NodeDoc,
  newId,
  newSharedCopy,
  pastedCopies,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { currentPage, type EditorSession } from "../editor/editor-session.js";
import { labelFor } from "../editor/labels.js";
import { findNode } from "../editor/nodes.js";

/**
 * The Add panel's catalogue (F-ED-1) and where a click adds to the page: sections between
 * sections, elements inside sections. The Header, Footer and child-only components such as an
 * FAQ's questions are never offered (ADR 0005). The site's shared sections are offered too, each
 * placed as a linked copy (F-ED-23).
 */

/** The Add panel's tabs. */
export type AddTab = "sections" | "elements";

/** A component the Add panel offers. */
export type AddItem = {
  /** Its component type ("Hero"); for a shared section, its id. */
  readonly type: string;
  /** Its display name ("Hero"). */
  readonly label: string;
  /** Its group in the panel ("Heroes"); empty when it has none. */
  readonly category: string;
  /** Set for a shared section, which a click places as a linked copy; it can't be dragged. */
  readonly sharedSectionId?: SharedSectionId;
  /** Set for an item listed again, among the favourites or recently used. */
  readonly repeat?: true;
  /**
   * Set for an item under Suggested (SP-12): a List's item, a Columns' column, offered only there,
   * so it can't be a favourite.
   */
  readonly suggested?: true;
  /** Set for a component offered in Advanced mode only (Custom Code, F-ED-11). */
  readonly advancedOnly?: true;
  /**
   * Set for a component's preset (the Booking button, a Button, 2.11), whose `type` is
   * {@link presetKey}'s. A click places it; it can't be dragged, as the canvas drags in components.
   */
  readonly preset?: true;
};

/** What joins a preset's component and its id in its item's `type`: "Button#booking". */
const PRESET_MARK = "#";

/** The `type` of an Add item for component `type`'s preset `id`: "Button#booking". */
export function presetKey(type: string, id: string): string {
  return `${type}${PRESET_MARK}${id}`;
}

/**
 * What an Add item's `type` places: its component, with its preset's values over its defaults if
 * it is a preset's ({@link presetKey}). `undefined` for a component or preset the library lacks.
 */
function placed(
  library: ComponentLibrary,
  key: string,
): { readonly type: string; readonly values: Readonly<Record<string, unknown>> } | undefined {
  const [type = key, id] = key.split(PRESET_MARK);
  const definition = library.components[type];
  if (definition === undefined) return undefined;
  if (id === undefined) return { type, values: {} };
  const preset = definition.presets?.find((each) => each.id === id);
  return preset === undefined ? undefined : { type, values: preset.values };
}

/** The components `tab` offers, in library order, each followed by its presets. */
export function addItems(library: ComponentLibrary, tab: AddTab): AddItem[] {
  const place = tab === "sections" ? "section" : "element";
  return Object.entries(library.components)
    .filter(([, def]) => (def.place ?? "element") === place)
    .flatMap(([type, def]) => {
      const category = def.category ?? "";
      const level = def.advancedOnly === true ? { advancedOnly: true as const } : {};
      return [
        { type, label: def.label, category, ...level },
        ...(def.presets ?? []).map((preset) => ({
          type: presetKey(type, preset.id),
          label: preset.label,
          category,
          preset: true as const,
          ...level,
        })),
      ];
    });
}

/**
 * `items` as the Add panel offers them in `level`: in Simple mode, none offered in Advanced mode
 * only (Custom Code, F-ED-11). One already on a page stays there in either mode.
 */
export function forLevel(items: readonly AddItem[], level: "simple" | "advanced"): AddItem[] {
  return level === "advanced" ? [...items] : items.filter((item) => item.advancedOnly !== true);
}

/** The site's shared sections, by name, as the Sections tab offers them first (F-ED-23). */
export function sharedSectionItems(site: SiteDoc): AddItem[] {
  const category = t("add.sharedSections");
  return Object.values(site.sharedSections)
    .map((shared) => ({
      type: shared.id,
      label: shared.name,
      category,
      sharedSectionId: shared.id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * `items` led by the person's `favourites`, then the ones they `recent`ly added (F-ED-26, UX-10),
 * each in a group of its own as well as in its own category. Keys of items `items` doesn't have
 * (a shared section deleted since, an element on the other tab) are left out.
 */
export function withFavourites(
  items: readonly AddItem[],
  favourites: readonly string[],
  recent: readonly string[],
): AddItem[] {
  const byType = new Map(items.map((item) => [item.type, item]));
  const group = (keys: readonly string[], category: string) =>
    keys.flatMap((key) => {
      const item = byType.get(key);
      return item === undefined ? [] : [{ ...item, category, repeat: true as const }];
    });
  return [...group(favourites, t("add.favourites")), ...group(recent, t("add.recent")), ...items];
}

/**
 * `items` matching what the person typed (in the name or the group, ignoring case), grouped by
 * category in order of first appearance. While searching, an item is found once, in its own
 * group: not again among the favourites or recently used, unless only that group matches.
 */
export function groupItems(
  items: readonly AddItem[],
  query: string,
): { category: string; items: AddItem[] }[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = (item: AddItem) => {
    const text = `${item.label} ${item.category}`.toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  };
  const foundInOwnGroup = new Set(
    words.length === 0
      ? []
      : items.filter((item) => !item.repeat && matches(item)).map((item) => item.type),
  );
  const groups = new Map<string, AddItem[]>();
  for (const item of items) {
    if (matches(item) && !(item.repeat && foundInOwnGroup.has(item.type))) {
      groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
    }
  }
  return [...groups].map(([category, grouped]) => ({ category, items: grouped }));
}

/** Where a new element goes: a list on the page, by its parent and slot, and a position in it. */
export type AddTarget = {
  /** The element whose slot it goes in, or `null` for the page's top level. */
  readonly parentId: string | null;
  /** That element's slot field; `null` at the top level. */
  readonly slot: string | null;
  readonly index: number;
};

/** Whether `type` may go in the slot `slot` of `parent`, which is not yet full (a Columns' four). */
function accepts(library: ComponentLibrary, parent: NodeDoc, slot: string, type: string): boolean {
  const field = library.components[parent.type]?.fields[slot];
  return (
    field?.kind === "slot" &&
    (field.allow === undefined || field.allow.includes(type)) &&
    (field.max === undefined || childrenOf(parent, slot).length < field.max)
  );
}

/** The slot fields of `node` that take `type`, in field order. */
function slotsFor(library: ComponentLibrary, node: NodeDoc, type: string): string[] {
  return Object.keys(library.components[node.type]?.fields ?? {}).filter((slot) =>
    accepts(library, node, slot, type),
  );
}

/** The children of `node` in `slot`. */
const childrenOf = (node: NodeDoc, slot: string): NodeDoc[] => {
  const value = node.props[slot];
  return Array.isArray(value) ? value.filter(isNodeDoc) : [];
};

/** One step from the page's top level down to a node: the node, and where it sits. */
type Step = {
  readonly node: NodeDoc;
  readonly parent: NodeDoc | null;
  readonly slot: string | null;
};

/** The steps from the top level down to the node `id`, or `undefined` if it isn't on the page. */
function pathTo(
  nodes: readonly NodeDoc[],
  id: string,
  parent: NodeDoc | null = null,
  slot: string | null = null,
): Step[] | undefined {
  for (const node of nodes) {
    if (node.props.id === id) {
      return [{ node, parent, slot }];
    }
    for (const [name, value] of Object.entries(node.props)) {
      if (!Array.isArray(value)) continue;
      const below = pathTo(value.filter(isNodeDoc), id, node, name);
      if (below !== undefined) return [{ node, parent, slot }, ...below];
    }
  }
  return undefined;
}

/** The page's own element `selectedId` stands for: a linked copy for any element it shows. */
const ownId = (content: readonly NodeDoc[], selectedId: string | null) =>
  selectedId === null ? null : (copyHolding(content, selectedId)?.props.id ?? selectedId);

/** Where a section goes: at the + button's `point`, else after the selection's section, else last. */
function sectionTarget(
  content: readonly NodeDoc[],
  selectedId: string | null,
  point?: InsertPoint,
): AddTarget {
  if (point !== undefined) {
    return { parentId: null, slot: null, index: Math.min(point.index, content.length) };
  }
  const id = ownId(content, selectedId);
  const top = id === null ? undefined : pathTo(content, id)?.[0]?.node;
  return {
    parentId: null,
    slot: null,
    index: top === undefined ? content.length : content.indexOf(top) + 1,
  };
}

/**
 * Where a click adds a component of `type` to a page with top-level `content`:
 * - a section goes at the + button's `point` if there is one, else after the section that holds
 *   the selection, else at the end of the page;
 * - an element goes into the selection if it takes it (at its end), else after the selection,
 *   else the same for the elements holding it, nearest first. Failing that, it goes at the end of
 *   the nearest section that takes it: before the selection's section first, then after; with
 *   nothing selected, the last one. `undefined` when nothing on the page takes it.
 * An element shown in a linked copy counts as the copy: nothing goes into a shared section from
 * here, so adding never changes other pages (F-ED-23).
 */
export function addTarget(
  library: ComponentLibrary,
  content: readonly NodeDoc[],
  type: string,
  selectedId: string | null,
  point?: InsertPoint,
): AddTarget | undefined {
  if ((library.components[type]?.place ?? "element") === "section") {
    return sectionTarget(content, selectedId, point);
  }
  const id = ownId(content, selectedId);
  const path = id === null ? undefined : pathTo(content, id);
  for (const step of [...(path ?? [])].reverse()) {
    const [inside] = slotsFor(library, step.node, type);
    if (inside !== undefined) {
      return {
        parentId: step.node.props.id,
        slot: inside,
        index: childrenOf(step.node, inside).length,
      };
    }
    if (
      step.parent !== null &&
      step.slot !== null &&
      accepts(library, step.parent, step.slot, type)
    ) {
      return {
        parentId: step.parent.props.id,
        slot: step.slot,
        index: childrenOf(step.parent, step.slot).indexOf(step.node) + 1,
      };
    }
  }
  const top = path?.[0]?.node;
  const from = top === undefined ? content.length - 1 : content.indexOf(top);
  const nearest = [...content.slice(0, from + 1).reverse(), ...content.slice(from + 1)];
  for (const node of nearest) {
    const [inside] = slotsFor(library, node, type);
    if (inside !== undefined) {
      return { parentId: node.props.id, slot: inside, index: childrenOf(node, inside).length };
    }
  }
  return undefined;
}

/**
 * Inserts `nodes` at `target` in a page's top-level `content` (an undo step's draft), as the Add
 * panel and Paste do. Nothing happens if the target's element is no longer there.
 */
export function insertAt(content: NodeDoc[], target: AddTarget, nodes: readonly NodeDoc[]): void {
  if (target.parentId === null || target.slot === null) {
    content.splice(target.index, 0, ...nodes);
    return;
  }
  const { parentId, slot } = target;
  const parent = findNode(content, (candidate) => candidate.props.id === parentId);
  if (parent === undefined) return;
  const list = parent.props[slot];
  if (Array.isArray(list)) {
    list.splice(target.index, 0, ...nodes);
  } else {
    parent.props[slot] = [...nodes];
  }
}

/** The parts of an editor session adding uses. */
export type AddSession = Pick<EditorSession, "history" | "ui" | "edit" | "library">;

/**
 * Where a click on `type` (a component's, or a preset's, {@link presetKey}) would add it on the
 * shown page, if anywhere.
 */
export function addTargetFor(
  session: AddSession,
  type: string,
  point?: InsertPoint,
): AddTarget | undefined {
  const component = placed(session.library, type)?.type;
  if (component === undefined) return undefined;
  const content = currentPage(session)?.doc.content ?? [];
  return addTarget(session.library, content, component, session.ui.getState().nodeId, point);
}

/**
 * Adds a new `key` (a component's type, or a preset's, {@link presetKey}), with its defaults and
 * a preset's values, to the shown page where {@link addTarget} puts it, as one "Added …" step that
 * selects it. Returns whether it was added.
 */
export function addComponent(session: AddSession, key: string, point?: InsertPoint): boolean {
  const added = placed(session.library, key);
  const type = added?.type ?? key;
  const definition = session.library.components[type];
  const page = currentPage(session)?.doc;
  const target = addTargetFor(session, key, point);
  if (
    added === undefined ||
    definition === undefined ||
    page === undefined ||
    target === undefined
  ) {
    return false;
  }
  const { pageId, viewport } = session.ui.getState();
  const id = newId("node");
  const label = labelFor(
    { kind: "insert", nodeId: id, componentType: type, field: null, page, selection: id },
    session.library,
  );
  session.edit(
    "insert",
    label,
    (draft) => {
      const content = draft.pages[pageId]?.doc.content;
      if (content === undefined) return;
      // Every element in its defaults (a Columns' columns) gets an id of its own too.
      const ids = [id];
      const [node] = pastedCopies(
        [{ type, props: { ...definition.defaults, ...added.values, id } } as NodeDoc],
        new Set(),
        () => ids.shift() ?? newId("node"),
      );
      if (node !== undefined) insertAt(content, target, [node]);
    },
    { selectionAfter: { pageId, viewport, nodeId: id }, apply: true },
  );
  return true;
}

/**
 * The Add panel's *Suggested* group (SP-12): the types the selected element's slots name as theirs
 * (a List's items, a Columns' columns, an FAQ's questions), and, for such an item, the types its
 * parent's slot names, so another can go beside it. A slot that takes any element suggests
 * nothing: everything fits there. Full slots (a Columns' four) suggest nothing either, nor does
 * anything in a linked copy, which adding never changes (F-ED-23).
 */
export function suggestedTypes(
  library: ComponentLibrary,
  content: readonly NodeDoc[],
  selectedId: string | null,
): string[] {
  const id = ownId(content, selectedId);
  if (id === null || id !== selectedId) return [];
  const step = pathTo(content, id)?.at(-1);
  if (step === undefined) return [];
  const named = (node: NodeDoc, slots: readonly string[]) =>
    slots.flatMap((slot) => {
      const field = library.components[node.type]?.fields[slot];
      if (field?.kind !== "slot" || field.accepts !== undefined || field.allow === undefined) {
        return [];
      }
      return field.allow.filter((type) => accepts(library, node, slot, type));
    });
  const own = named(step.node, Object.keys(library.components[step.node.type]?.fields ?? {}));
  const beside = step.parent === null || step.slot === null ? [] : named(step.parent, [step.slot]);
  return [...new Set([...own, ...beside])].filter((type) => library.components[type] !== undefined);
}

/** The Suggested group's items for `types`, listed again under *Suggested* (SP-12). */
export function suggestedItems(library: ComponentLibrary, types: readonly string[]): AddItem[] {
  const category = t("add.suggested");
  return types.flatMap((type) => {
    const def = library.components[type];
    return def === undefined
      ? []
      : [{ type, label: def.label, category, repeat: true as const, suggested: true as const }];
  });
}

/**
 * Places a linked copy of shared section `id` on the shown page where a section would go (F-ED-23),
 * as one "Added a copy of 'Opening hours'" step that selects it as the canvas shows it. Another
 * copy on the same page gets anchors of its own. Returns whether it was placed.
 */
export function addSharedCopy(
  session: AddSession,
  id: SharedSectionId,
  point?: InsertPoint,
): boolean {
  const site = session.history.document.getState();
  const shared = Object.hasOwn(site.sharedSections, id) ? site.sharedSections[id] : undefined;
  const page = currentPage(session)?.doc;
  if (shared === undefined || page === undefined) {
    return false;
  }
  const { pageId, viewport, nodeId: selected } = session.ui.getState();
  const target = sectionTarget(page.content, selected, point);
  const copy = newSharedCopy(page.content, id, site.sharedSections, site.layout);
  // The copy's section, by the copy's id for it, as the canvas selects it.
  const nodeId = copiedNodeId(copy.props.id, shared.section.props.id);
  session.edit(
    "insert",
    t("history.addedSharedCopy", { name: t("history.namedItem", { name: shared.name }) }),
    (draft) => {
      const content = draft.pages[pageId]?.doc.content;
      if (content !== undefined) insertAt(content, target, [copy]);
    },
    { selectionAfter: { pageId, viewport, nodeId }, apply: true },
  );
  return true;
}
