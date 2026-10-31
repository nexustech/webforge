import { t } from "@webforge/i18n";
import {
  copiedNodeId,
  findNode,
  isNodeDoc,
  isSharedCopy,
  LAYER_NAME_MAX,
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
  regionHidden,
  SHARED_REGIONS,
  type SharedRegion,
  shownLayout,
} from "../editor/shared-layout.js";

/**
 * Layers (F-ED-12, Advanced): the shown page's sections and elements as a tree, and the changes the
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
  readonly hidden: boolean;
  readonly children: readonly Layer[];
  /** Set for a linked copy: the name of the shared section it shows (F-ED-23). */
  readonly sharedSection?: string;
  /**
   * It can't be moved or deleted, only edited (UX-12), as the shared Header and Footer themselves
   * are. Nothing the page lists is locked yet; Layers marks it when something is.
   */
  readonly locked?: boolean;
  /** It has an entrance animation (UX-12, 2.12); Layers marks it. */
  readonly animated?: boolean;
  /**
   * The shared Header or Footer it is (#673): first or last on every page, marked as shared,
   * never moved among the page's sections. Hidden while the page's settings hide it.
   */
  readonly region?: SharedRegion;
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
        children: slotsOf(node, library).flatMap((list) => layersOf(list, library, shared)),
        ...(hasEntrance(node.props) ? { animated: true } : {}),
      },
    ];
  });
}

/**
 * Page `pageId`'s whole Layers tree (#673): the shared Header first, then the page's own sections,
 * then the shared Footer. The Header's and Footer's layers are marked with their region, and are
 * hidden while the page's settings hide them.
 */
export function pageLayers(
  site: Pick<SiteDoc, "pages" | "layout" | "sharedSections">,
  pageId: PageId,
  library: ComponentLibrary,
): Layer[] {
  const region = (which: SharedRegion): Layer[] =>
    layersOf(site.layout[which], library, site.sharedSections).map((layer) => ({
      ...layer,
      region: which,
      hidden: regionHidden(site as SiteDoc, pageId, which),
    }));
  const content = site.pages[pageId]?.doc.content ?? [];
  return [
    ...region("header"),
    ...layersOf(content, library, site.sharedSections),
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
 * The shown page and the layer `id` on it, before a change, with the page's own node for it; or
 * the layer in the shared Header or Footer (#673), with its region, and whether it is the region's
 * own top layer (the Header itself), which the page's settings show or hide.
 */
function target(session: LayersSession, id: string) {
  const { pageId } = session.ui.getState();
  const site = session.history.document.getState();
  const page: PageDoc | undefined = site.pages[pageId]?.doc;
  const own = page === undefined ? id : ownId(page.content, site.sharedSections, id);
  const node = page === undefined ? undefined : findNode(page.content, (n) => n.props.id === own);
  if (node !== undefined) {
    const [layer] = layersOf([node], session.library, site.sharedSections);
    return layer === undefined ? undefined : { pageId, layer, own };
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
      layer: top ? { ...layer, region, hidden: regionHidden(site, pageId, region) } : layer,
      own: id,
      region,
      top,
    };
  }
  return undefined;
}

/**
 * Runs `change` on the page's own node `own` for layer `id` (which a step that selects selects) on
 * the shown page, or in the shared `region` it is in (#673), as one undo step.
 */
function editNode(
  session: LayersSession,
  {
    id,
    own,
    region,
  }: { readonly id: string; readonly own: string; readonly region?: SharedRegion | undefined },
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
  session.edit(
    kind,
    label,
    (draft) => {
      const content =
        region === undefined ? draft.pages[pageId]?.doc.content : draft.layout[region];
      const place = content === undefined ? undefined : placeOf(content, own, session.library);
      const node = place?.list[place.index];
      if (place !== undefined && node !== undefined) {
        change(node, place);
      }
    },
    { selectionAfter, apply: true },
  );
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
  editNode(session, { id, own: found.own, region: found.region }, "props", false, label, (node) => {
    if (next === "") {
      delete node.props.layerName;
    } else {
      node.props.layerName = next;
    }
  });
}

/**
 * Hides a layer (dimmed on the canvas, left out of the export), or shows it again. The shared
 * Header or Footer itself is hidden on the shown page only, by its *Hide the Header on this page*
 * setting, which Page Settings shows too (#673, product owner, 30 Oct 2026).
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
      t(key, { item: found.layer.kind }),
      (draft) => {
        const page = draft.pages[found.pageId];
        if (page !== undefined) page.settings[hiddenSetting(region)] = hidden;
      },
      { selectionAfter: session.ui.getState(), apply: true },
    );
    return;
  }
  const key = hidden ? "layers.history.hid" : "layers.history.showed";
  const at = { id, own: found.own, region: found.region };
  editNode(session, at, "props", false, t(key, { item: layerItem(found.layer) }), (node) => {
    if (hidden) {
      node.props.hidden = true;
    } else {
      delete node.props.hidden;
    }
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

/** Hides a layer, or shows it again if it is hidden (F-ED-27: Mod + /, and the chip's *Hide*). */
export function toggleLayerHidden(session: LayersSession, id: string): void {
  const found = target(session, id);
  if (found !== undefined) setLayerHidden(session, id, !found.layer.hidden);
}

/**
 * Moves a layer to `index` among its siblings (by drag or Mod+Alt+arrow), as one step. An index past
 * either end, or the layer's own place, changes nothing.
 */
export function moveLayer(session: LayersSession, id: string, index: number): void {
  const found = target(session, id);
  // The Header's and Footer's own layers move among their region's only (#673).
  const site = session.history.document.getState();
  const content =
    found?.region === undefined
      ? site.pages[session.ui.getState().pageId]?.doc.content
      : site.layout[found.region];
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
    { id, own: found.own, region: found.region },
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
 * person: there's no room for it there (a Columns' four), or it holds a slot over its limit itself.
 */
export function copyLayer(
  session: LayersSession,
  id: string,
  index: number,
  linked: boolean,
): string | undefined {
  const found = target(session, id);
  // Not the shared Header's or Footer's (#673): the canvas copies none of theirs either.
  if (found?.region !== undefined) return undefined;
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
