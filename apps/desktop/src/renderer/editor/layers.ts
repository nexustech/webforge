import { t } from "@webforge/i18n";
import {
  type CollectionDesign,
  collectionOf,
  copiedNodeId,
  findNode,
  isNodeDoc,
  isSharedCopy,
  LAYER_NAME_MAX,
  NOTE_MAX,
  type NodeDoc,
  newSharedCopy,
  type PageDoc,
  type PageId,
  pageAnchors,
  pastedCopies,
  type SharedCopyNode,
  type SharedSectionsDoc,
  type SiteDoc,
} from "@webforge/model";
import {
  type ComponentLibrary,
  hasEntrance,
  holdsOverfullSlot,
  overfillsSlots,
} from "@webforge/site-components";
import type { EditorSession } from "../editor/editor-session.js";
import { elementKind, givenElementName, quotedName } from "../editor/labels.js";
import {
  hiddenSetting,
  inDesign,
  nodesAtHome,
  regionHidden,
  SHARED_REGIONS,
  type SharedHome,
  type SharedRegion,
  shownLayout,
} from "../editor/shared-layout.js";

/**
 * Layers (F-ED-12, ADR 0011): the shown page's sections and elements as a tree, and the changes the
 * Layers panel makes to them, each one labelled undo step that keeps the element selected. A linked
 * copy of a shared section is one layer, under the id the canvas shows its section by, so selecting
 * either selects the other; its name and hidden state are the copy's own (F-ED-23).
 */

/** One row of the Layers tree. */
export type Layer = {
  readonly id: string;
  /** The component's display name ("Heading"). */
  readonly kind: string;
  /** The name the person gave it in Layers, if any. */
  readonly name: string | undefined;
  /** *Don't publish* (F-ED-12, UX-23): dimmed on the canvas, left out of the export. */
  readonly hidden: boolean;
  /** *Hide while editing* (UX-23, #864): not drawn on the canvas, exported. */
  readonly editorHidden?: boolean;
  /** Its note (UX-17, #868), if it has one: Layers marks it. */
  readonly note?: string;
  readonly children: readonly Layer[];
  /** Set for a linked copy: the name of the shared section it shows (F-ED-23). */
  readonly sharedSection?: string;
  /**
   * It can't be moved or deleted, only edited (UX-12), as the shared Header and Footer themselves
   * are: a top-level section of a Blog's design (#936).
   */
  readonly locked?: boolean;
  /** It has an entrance animation (UX-12, 2.12); Layers marks it. */
  readonly animated?: boolean;
  /**
   * The shared Header or Footer it is (#673): first or last on every page, marked as shared,
   * never moved among the page's sections. Hidden while the page's settings hide it.
   */
  readonly region?: SharedRegion;
  /**
   * The part of a Blog's design it is (#936): above the post's own sections or below them, on every
   * post. Set on the design's top-level layers.
   */
  readonly design?: keyof CollectionDesign;
};

/** The node lists inside `node`: its slots' contents, in field order. */
function slotsOf(node: NodeDoc, library: ComponentLibrary): NodeDoc[][] {
  const fields = library.components[node.type]?.fields ?? {};
  return Object.entries(fields)
    .filter(([, field]) => field.kind === "slot")
    .map(([name]) => {
      const value = node.props[name];
      return Array.isArray(value) ? value.filter(isNodeDoc) : [];
    });
}

/** The shared section a linked copy shows, if the site has it. */
function sectionOf(shared: SharedSectionsDoc, copy: NodeDoc & SharedCopyNode) {
  const id = copy.props.sharedSectionId;
  return Object.hasOwn(shared, id) ? shared[id] : undefined;
}

/**
 * The Layers tree of `nodes`: each node with the nodes in its slots as children. A linked copy is
 * one layer, named after its shared section unless it has a name of its own; its section's elements
 * are edited on the canvas. A copy of a shared section the site doesn't have shows nothing.
 */
export function layersOf(
  nodes: readonly NodeDoc[],
  library: ComponentLibrary,
  shared: SharedSectionsDoc = {},
): Layer[] {
  return nodes.flatMap((node): Layer[] => {
    const kind = elementKind(node, library, shared);
    const name = givenElementName(node, shared);
    if (isSharedCopy(node)) {
      const entry = sectionOf(shared, node);
      if (entry === undefined) return [];
      return [
        {
          id: copiedNodeId(node.props.id, entry.section.props.id),
          kind,
          name,
          hidden: node.props.hidden === true,
          ...(node.props.editorHidden === true ? { editorHidden: true } : {}),
          ...(typeof node.props.note === "string" ? { note: node.props.note } : {}),
          children: [],
          sharedSection: entry.name,
          // A copy shows its shared section, entrance and all.
          ...(hasEntrance(entry.section.props) ? { animated: true } : {}),
        },
      ];
    }
    return [
      {
        id: node.props.id,
        kind,
        name,
        hidden: node.props.hidden === true,
        ...(node.props.editorHidden === true ? { editorHidden: true } : {}),
        ...(typeof node.props.note === "string" ? { note: node.props.note } : {}),
        children: slotsOf(node, library).flatMap((list) => layersOf(list, library, shared)),
        ...(hasEntrance(node.props) ? { animated: true } : {}),
      },
    ];
  });
}

/**
 * Page `pageId`'s whole Layers tree (#673), as the canvas draws it: the shared Header first, then
 * a post's Blog design above it (#936), the page's own sections, the design below it, then the
 * shared Footer. The Header's and Footer's layers are marked with their region, and are hidden
 * while the page's settings hide them, or while hidden themselves, on every page. The design's
 * top-level layers are marked with their part and locked, as the canvas locks them.
 */
export function pageLayers(
  site: Pick<SiteDoc, "pages" | "layout" | "sharedSections" | "collections">,
  pageId: PageId,
  library: ComponentLibrary,
): Layer[] {
  const region = (which: SharedRegion): Layer[] =>
    layersOf(site.layout[which], library, site.sharedSections).map((layer) => ({
      ...layer,
      region: which,
      hidden: layer.hidden || regionHidden(site, pageId, which),
    }));
  const page = site.pages[pageId];
  const design = page === undefined ? undefined : collectionOf(site, page)?.design;
  const part = (which: keyof CollectionDesign): Layer[] =>
    design === undefined
      ? []
      : layersOf(design[which], library, site.sharedSections).map((layer) => ({
          ...layer,
          design: which,
          locked: true,
        }));
  return [
    ...region("header"),
    ...part("before"),
    ...layersOf(page?.doc.content ?? [], library, site.sharedSections),
    ...part("after"),
    ...region("footer"),
  ];
}

/** How undo labels name a layer: its own name in quotes, else its component ("Heading"). */
export const layerItem = (layer: Pick<Layer, "kind" | "name">) =>
  quotedName(layer.kind, layer.name);

/** The node list holding the node `id`, and its index there, searching slots too. */
export function placeOf(
  nodes: NodeDoc[],
  id: string,
  library: ComponentLibrary,
): { list: NodeDoc[]; index: number } | undefined {
  const index = nodes.findIndex((node) => node.props.id === id);
  if (index !== -1) {
    return { list: nodes, index };
  }
  for (const node of nodes) {
    const fields = library.components[node.type]?.fields ?? {};
    for (const [field, def] of Object.entries(fields)) {
      const value = node.props[field];
      if (def.kind === "slot" && Array.isArray(value)) {
        const found = placeOf(value as NodeDoc[], id, library);
        if (found !== undefined) return found;
      }
    }
  }
  return undefined;
}

/** The parts of an editor session the Layers panel uses. */
export type LayersSession = Pick<EditorSession, "history" | "ui" | "edit" | "library">;

/** The page's own node for layer `id`: a linked copy for the id the canvas shows its section by. */
export function ownId(content: readonly NodeDoc[], shared: SharedSectionsDoc, id: string): string {
  const copy = content.filter(isSharedCopy).find((node) => {
    const section = sectionOf(shared, node)?.section;
    return section !== undefined && copiedNodeId(node.props.id, section.props.id) === id;
  });
  return copy?.props.id ?? id;
}

/**
 * The shown page and the layer `id` on it, before a change, with the page's own node for it; the
 * layer in a post's Blog design (#936), with where in it, its top-level layers locked; or the layer
 * in the shared Header or Footer (#673), with its region, and whether it is the region's own top
 * layer (the Header itself), which the page's settings show or hide.
 */
function target(session: LayersSession, id: string) {
  const { pageId } = session.ui.getState();
  const site = session.history.document.getState();
  const entry = site.pages[pageId];
  const page: PageDoc | undefined = entry?.doc;
  const own = page === undefined ? id : ownId(page.content, site.sharedSections, id);
  const node = page === undefined ? undefined : findNode(page.content, (n) => n.props.id === own);
  if (node !== undefined) {
    const [layer] = layersOf([node], session.library, site.sharedSections);
    return layer === undefined ? undefined : { pageId, layer, own };
  }
  const collection = entry === undefined ? undefined : collectionOf(site, entry);
  for (const part of ["before", "after"] as const) {
    const nodes = collection?.design[part] ?? [];
    const designNode = findNode(nodes, (n) => n.props.id === id);
    if (collection === undefined || designNode === undefined) continue;
    const [layer] = layersOf([designNode], session.library, site.sharedSections);
    if (layer === undefined) return undefined;
    const top = nodes.some((each) => each.props.id === id);
    const home: SharedHome = { collection: collection.id, part };
    return { pageId, layer: top ? { ...layer, design: part, locked: true } : layer, own: id, home };
  }
  for (const region of SHARED_REGIONS) {
    const nodes = site.layout[region];
    const shared = findNode(nodes, (n) => n.props.id === id);
    if (shared === undefined) continue;
    const top = nodes.some((each) => each.props.id === id);
    const [layer] = layersOf([shared], session.library, site.sharedSections);
    if (layer === undefined) return undefined;
    return {
      pageId,
      layer: top
        ? { ...layer, region, hidden: layer.hidden || regionHidden(site, pageId, region) }
        : layer,
      own: id,
      home: region,
      region,
      top,
    };
  }
  return undefined;
}

/**
 * Runs `change` on the page's own node `own` for layer `id` (which a step that selects selects) on
 * the shown page, or where else it is kept, `home`: the shared Header or Footer (#673), or a
 * Blog's design (#936), whose changes are named by the Blog. One undo step.
 */
function editNode(
  session: LayersSession,
  {
    id,
    own,
    home,
  }: { readonly id: string; readonly own: string; readonly home?: SharedHome | undefined },
  kind: "props" | "move",
  /** Whether the step selects the layer (a move does; a hide or rename leaves the selection). */
  select: boolean,
  label: string,
  change: (node: NodeDoc, place: { list: NodeDoc[]; index: number }) => void,
): void {
  const current = session.ui.getState();
  const { pageId } = current;
  // A step that selects selects the layer alone: keeping the others could list it twice (#262).
  const selectionAfter = select ? { ...current, nodeId: id, others: [] } : current;
  const site = session.history.document.getState();
  const named =
    home === undefined || typeof home === "string"
      ? label
      : label + inDesign(site, home.collection);
  session.edit(
    kind,
    named,
    (draft) => {
      const content =
        home === undefined ? draft.pages[pageId]?.doc.content : nodesAtHome(draft, home);
      const place = content === undefined ? undefined : placeOf(content, own, session.library);
      const node = place?.list[place.index];
      if (place !== undefined && node !== undefined) {
        change(node, place);
      }
    },
    { selectionAfter, apply: true },
  );
}

/** Layer `id` on the shown page, the shared Header's and Footer's included, if it is one. */
export function layerOf(session: LayersSession, id: string): Layer | undefined {
  return target(session, id)?.layer;
}

/**
 * Gives layer `id` the note `note` (UX-17, #868), changes it, or resolves it when `note` is empty:
 * one undo step each, none when it stays the same. Trimmed and cut to {@link NOTE_MAX}.
 */
export function setLayerNote(session: LayersSession, id: string, note: string): void {
  const found = target(session, id);
  const next = note.trim().slice(0, NOTE_MAX).trim();
  if (found === undefined || next === (found.layer.note ?? "")) return;
  const key =
    next === ""
      ? "notes.history.resolved"
      : found.layer.note === undefined
        ? "notes.history.added"
        : "notes.history.changed";
  const at = { id, own: found.own, home: found.home };
  editNode(session, at, "props", false, t(key, { item: layerItem(found.layer) }), (node) => {
    if (next === "") delete node.props.note;
    else node.props.note = next;
  });
}

/**
 * Names a layer (shown in Layers and undo labels: "Edited 'Opening times' text"). An empty name
 * removes it, so the component's name shows again.
 */
export function renameLayer(session: LayersSession, id: string, name: string): void {
  const found = target(session, id);
  const next = name.trim().slice(0, LAYER_NAME_MAX).trim();
  if (found === undefined || next === (found.layer.name ?? "")) {
    return;
  }
  // A copy shows its shared section's name until it has one of its own: clearing it changes
  // nothing then.
  const named = found.layer.name === found.layer.sharedSection ? undefined : found.layer.name;
  if (named === undefined && next === "") {
    return;
  }
  const label =
    next === ""
      ? t("layers.history.unnamed", { item: layerItem(found.layer) })
      : t("layers.history.renamed", { item: found.layer.kind, name: next });
  editNode(session, { id, own: found.own, home: found.home }, "props", false, label, (node) => {
    if (next === "") {
      delete node.props.layerName;
    } else {
      node.props.layerName = next;
    }
  });
}

/** How a layer shows (UX-23): drawn and published, hidden while editing, or not published. */
export type LayerShown = "shown" | "editorHidden" | "hidden";

/** How `layer` shows. Not published wins, as the export leaves it out whatever else it says. */
export function layerShown(layer: Layer): LayerShown {
  return layer.hidden ? "hidden" : layer.editorHidden === true ? "editorHidden" : "shown";
}

/**
 * Whether layer `id` can be hidden while editing (UX-23): any but the shared Header or Footer
 * itself, which isn't published on a page by that page's settings.
 */
function canHideWhileEditing(session: LayersSession, id: string): boolean {
  const found = target(session, id);
  return found !== undefined && !(found.region !== undefined && found.top === true);
}

/**
 * Shows a layer as `shown` says (UX-23, #864): *Hide while editing* or *Don't publish*, each of
 * which ends the other, or *Show*, which ends both. One undo step, none when nothing changes or
 * when the shared Header or Footer itself would be hidden while editing.
 */
export function setLayerShown(session: LayersSession, id: string, shown: LayerShown): void {
  const found = target(session, id);
  if (found === undefined || layerShown(found.layer) === shown) return;
  // Not published, or published again: each ends *Hide while editing* too.
  if (shown === "hidden" || (shown === "shown" && found.layer.hidden)) {
    setLayerHidden(session, id, shown === "hidden");
    return;
  }
  if (shown === "editorHidden" && !canHideWhileEditing(session, id)) return;
  const at = { id, own: found.own, home: found.home };
  const editing = shown === "editorHidden";
  const key = editing ? "layers.history.hidWhileEditing" : "layers.history.showed";
  editNode(session, at, "props", false, t(key, { item: layerItem(found.layer) }), (node) => {
    if (editing) {
      node.props.editorHidden = true;
      delete node.props.hidden;
    } else {
      delete node.props.editorHidden;
    }
  });
}

/**
 * Hides a layer (dimmed on the canvas, left out of the export), or shows it again. The shared
 * Header or Footer itself is hidden on the shown page only, by its *Hide the Header on this page*
 * setting, which Page Settings shows too (#673, product owner, 30 Oct 2026). Shown again, it is
 * shown by that setting and by its own, which hides it on every page (Mod+/ sets that), so the eye
 * can always bring it back.
 */
export function setLayerHidden(session: LayersSession, id: string, hidden: boolean): void {
  const found = target(session, id);
  if (found === undefined || found.layer.hidden === hidden) {
    return;
  }
  if (found.region !== undefined && found.top === true) {
    const region = found.region;
    const key = hidden ? "layers.history.hidRegion" : "layers.history.showedRegion";
    session.edit(
      "props",
      // Named as Page Settings names it, whatever the region's first section is (a Navbar).
      t(key, { item: t(`canvas.sharedRegion.${region}`) }),
      (draft) => {
        const page = draft.pages[found.pageId];
        if (page !== undefined) page.settings[hiddenSetting(region)] = hidden;
        if (!hidden) {
          const node = draft.layout[region].find((each) => each.props.id === found.own);
          if (node !== undefined) {
            delete node.props.hidden;
            delete node.props.editorHidden;
          }
        }
      },
      { selectionAfter: session.ui.getState(), apply: true },
    );
    return;
  }
  const key = hidden ? "layers.history.hid" : "layers.history.showed";
  const at = { id, own: found.own, home: found.home };
  editNode(session, at, "props", false, t(key, { item: layerItem(found.layer) }), (node) => {
    if (hidden) {
      node.props.hidden = true;
    } else {
      delete node.props.hidden;
    }
    // Neither is hidden while editing as well (UX-23): not published is drawn dimmed, shown is drawn.
    delete node.props.editorHidden;
  });
}

/** The layer `id` in `layers` or among their children. */
function findLayer(layers: readonly Layer[], id: string): Layer | undefined {
  for (const layer of layers) {
    if (layer.id === id) return layer;
    const inside = findLayer(layer.children, id);
    if (inside !== undefined) return inside;
  }
  return undefined;
}

/**
 * Element `id`'s layer on the shown page, if it is one: not an element of the shared Header or
 * Footer, nor one inside a linked copy (the copy is one layer).
 */
export function shownLayer(session: LayersSession, id: string): Layer | undefined {
  const site = session.history.document.getState();
  const content = site.pages[session.ui.getState().pageId]?.doc.content;
  return content === undefined
    ? undefined
    : findLayer(layersOf(content, session.library, site.sharedSections), id);
}

/**
 * *Don't publish* a layer, or shows it again if it isn't published (F-ED-27: Mod + /, and the
 * chip's *Don't publish*).
 */
export function toggleLayerHidden(session: LayersSession, id: string): void {
  const found = target(session, id);
  if (found !== undefined) setLayerHidden(session, id, !found.layer.hidden);
}

/**
 * Moves a layer to `index` among its siblings (by drag or Mod+Alt+arrow), as one step. An index past
 * either end, the layer's own place, or a locked layer (a Blog design's section, #936) changes
 * nothing.
 */
export function moveLayer(session: LayersSession, id: string, index: number): void {
  const found = target(session, id);
  if (found?.layer.locked === true) return;
  // The Header's and Footer's own layers move among their region's only (#673), a design's among
  // the design's.
  const site = session.history.document.getState();
  const content =
    found?.home === undefined
      ? site.pages[session.ui.getState().pageId]?.doc.content
      : nodesAtHome(site, found.home);
  const place =
    content === undefined || found === undefined
      ? undefined
      : placeOf(content, found.own, session.library);
  if (
    found === undefined ||
    place === undefined ||
    index < 0 ||
    index >= place.list.length ||
    index === place.index
  ) {
    return;
  }
  editNode(
    session,
    { id, own: found.own, home: found.home },
    "move",
    true,
    t("history.moved", { item: layerItem(found.layer) }),
    (node, at) => {
      at.list.splice(at.index, 1);
      at.list.splice(index, 0, node);
    },
  );
}

/**
 * Copies a layer to `index` among its siblings, counted as they are now, by a Ctrl/Cmd-drag (1.35,
 * UX-4), as the canvas's own copy-drag does and in the same step: the copy has ids and anchors of
 * its own ("Duplicated Heading"). A linked copy is copied as its section, the page's own; with
 * `linked` (Shift too), it places another linked copy of the same shared section instead ("Added
 * a copy of 'Hours'"), F-ED-23. The copy is selected. Returns why a copy was refused, to tell the
 * person: there's no room for it there (a Columns' four), it holds a slot over its limit itself,
 * or it is in the shared Header or Footer (#673), whose elements the canvas doesn't copy either.
 */
export function copyLayer(
  session: LayersSession,
  id: string,
  index: number,
  linked: boolean,
): string | undefined {
  const found = target(session, id);
  // Not the shared Header's or Footer's (#673), nor a Blog design's (#936): the canvas copies none
  // of theirs either.
  if (found?.region !== undefined) {
    return t("layers.copyRegion", { region: t(`canvas.sharedRegion.${found.region}`) });
  }
  if (found?.home !== undefined) return t("layers.copyDesign");
  const site = session.history.document.getState();
  const current = session.ui.getState();
  const content = site.pages[current.pageId]?.doc.content;
  const place =
    content === undefined || found === undefined
      ? undefined
      : placeOf(content, found.own, session.library);
  const node = place?.list[place.index];
  if (found === undefined || content === undefined || place === undefined || node === undefined) {
    return;
  }
  if (index < 0 || index > place.list.length) return;
  const layout = shownLayout(site, current.pageId);
  const shared = isSharedCopy(node) ? site.sharedSections[node.props.sharedSectionId] : undefined;
  let copy: NodeDoc | undefined;
  let shown: string;
  let label: string;
  if (linked && isSharedCopy(node) && shared !== undefined) {
    copy = newSharedCopy(content, node.props.sharedSectionId, site.sharedSections, layout);
    shown = copiedNodeId(copy.props.id, shared.section.props.id);
    label = t("history.addedSharedCopy", { name: t("history.namedItem", { name: shared.name }) });
  } else {
    // A linked copy without Shift: its section, as the page's own (the canvas does the same).
    const original = shared === undefined ? node : shared.section;
    [copy] = pastedCopies([original], pageAnchors(content, site.sharedSections, layout));
    shown = copy?.props.id ?? id;
    // Named as what it copies, as the canvas names it: "Duplicated Section" for a copy's section.
    const [copied] = layersOf([original], session.library, site.sharedSections);
    label = t("history.duplicated", { item: layerItem(copied ?? found.layer) });
  }
  if (copy === undefined) return;
  const added = copy;
  // No more than its list's slot holds (a Columns' four).
  const after = structuredClone(content) as NodeDoc[];
  placeOf(after, found.own, session.library)?.list.splice(index, 0, added);
  if (overfillsSlots(session.library, content, after)) {
    return t(holdsOverfullSlot(session.library, [added]) ? "bulk.overfull" : "bulk.full");
  }
  const selectionAfter = { ...current, nodeId: shown, others: [] };
  session.edit(
    "duplicate",
    label,
    (draft) => {
      const list = draft.pages[current.pageId]?.doc.content;
      const at = list === undefined ? undefined : placeOf(list, found.own, session.library);
      at?.list.splice(index, 0, added);
    },
    { selectionAfter, apply: true },
  );
  return undefined;
}
