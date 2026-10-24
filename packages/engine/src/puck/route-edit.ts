import type { AppState, PuckAction } from "@puckeditor/core";
import {
  copiedNodeId,
  type LayoutDoc,
  type NodeDoc,
  newSharedCopy,
  type PageDoc,
  SHARED_COPY_TYPE,
  type SharedCopyNode,
  type SharedSectionsDoc,
} from "@webforge/model";
import type { EngineEdit } from "../canvas-engine.js";
import type { Drop } from "./drag-copies.js";
import { toPageDoc } from "./edit-from-action.js";
import { copiesOn, copyShownBy, foldCopies, shownInCopy } from "./shared-copies.js";
import { isShared, isSharedRegion, sameNodes, splitPage } from "./shared-layout.js";
import { nodeAt, ROOT_ZONE } from "./tree.js";

/** What the canvas shows: the page, the shared Header and Footer (F-ED-7), the shared sections. */
export type CanvasDocs = {
  readonly page: PageDoc;
  readonly layout: LayoutDoc;
  readonly shared: SharedSectionsDoc;
};

/** Where an edit Puck made goes ({@link routeEdit}). */
export type RoutedEdit = {
  /** The edit to report to the app; none when the canvas refuses it. */
  readonly emit?: EngineEdit;
  /** The page, layout and shared sections with the edit. */
  readonly next: CanvasDocs;
  /**
   * Puts Puck's view back in step with `next` (the Header and Footer in their places, every copy of
   * a section showing it): `always`, or only when its top-level order differs.
   */
  readonly putBack: "always" | "whenOutOfOrder";
};

/** Puck's view put back as it was: the edit is refused. */
const refuse = (docs: CanvasDocs): RoutedEdit => ({ next: docs, putBack: "always" });

/**
 * Where `edit`, which Puck made to the page as the canvas shows it (`action`, from Puck's state
 * `prev`), goes: split back into the page, the shared layout (F-ED-7) and the shared sections its
 * linked copies show (F-ED-23).
 * - An edit inside the Header or Footer goes to the layout, which every page shows.
 * - An edit inside a copy goes to its shared section, and so to every copy of it.
 * - Anything else is the page's own, a copy itself included (moved or deleted as a whole).
 * The Header and Footer themselves can't be moved, duplicated or deleted from the canvas, and an
 * element can't be moved between them, a copy and the page: the edit is refused. A duplicated copy
 * is another linked copy of its section. A page element Puck shows above the Header or below the
 * Footer belongs to the page, and goes back between them.
 */
export function routeEdit(
  edit: EngineEdit,
  action: PuckAction,
  prev: AppState,
  docs: CanvasDocs,
): RoutedEdit {
  const { page, layout, shared } = docs;
  const before = toPageDoc(prev.data);
  const touchedNode =
    action.type === "duplicate"
      ? nodeAt(before, action.sourceZone, action.sourceIndex)
      : action.type === "remove"
        ? nodeAt(before, action.zone, action.index)
        : undefined;
  const touched = touchedNode?.props.id ?? (edit.kind === "move" ? edit.nodeId : null);
  if (typeof touched === "string" && isSharedRegion(layout, touched)) {
    return refuse(docs);
  }
  const copy =
    action.type === "duplicate" && touchedNode !== undefined
      ? copyShownBy(touchedNode, copiesOn(page.content), shared)
      : undefined;
  if (copy !== undefined) {
    const at = page.content.indexOf(copy);
    const added = newSharedCopy(page.content, copy.props.sharedSectionId, shared, layout);
    const content = [...page.content];
    content.splice(at + 1, 0, added);
    const next = { ...docs, page: { ...page, content } };
    // The new copy selected as the canvas shows it: its section, by the copy's id for it.
    const root = shared[copy.props.sharedSectionId]?.section.props.id;
    const shown = root === undefined ? null : copiedNodeId(added.props.id, root);
    return {
      emit: {
        ...edit,
        nodeId: shown,
        page: next.page,
        selection: shown,
        copyOf: copy.props.sharedSectionId,
      },
      next,
      putBack: "always",
    };
  }
  const split = splitPage(edit.page, layout);
  const folded = foldCopies(split.page.content, page.content, shared);
  const id = edit.nodeId;
  // In the Header or Footer as they were (an edit, a removal) or are now (an element added in one).
  const inLayout = id !== null && (isShared(layout, id) || isShared(split.layout, id));
  const layoutChanged = !sameNodes(
    [...split.layout.header, ...split.layout.footer],
    [...layout.header, ...layout.footer],
  );
  const pageChanged = !sameNodes(folded.content, page.content);
  const [section, ...others] = folded.sections;
  const crossed = inLayout
    ? pageChanged || section !== undefined
    : section !== undefined
      ? pageChanged || layoutChanged || others.length > 0 || folded.refused
      : layoutChanged;
  if (crossed) {
    return refuse(docs);
  }
  if (inLayout) {
    const next = { ...docs, layout: split.layout };
    return {
      emit: { ...edit, page, shared: true, layout: next.layout },
      next,
      putBack: "whenOutOfOrder",
    };
  }
  if (section !== undefined) {
    const [sectionId, changed] = section;
    const content = changed.section;
    const entry = shared[sectionId];
    const next = {
      ...docs,
      shared:
        entry === undefined ? shared : { ...shared, [sectionId]: { ...entry, section: content } },
    };
    // An element added inside the copy shows under the copy's id for it once put back.
    const inCopy = (nodeId: string | null) => shownInCopy(changed, nodeId);
    // A one-field patch names the copy's element; the section is recorded whole instead.
    const { patch: _patch, ...whole } = edit;
    return {
      emit: {
        ...whole,
        nodeId: inCopy(edit.nodeId),
        selection: inCopy(edit.selection),
        page,
        sharedSection: { id: sectionId, section: content },
      },
      next,
      // Every other copy of the section shows the change too.
      putBack: "always",
    };
  }
  const next = { ...docs, page: { root: split.page.root, content: folded.content } };
  return { emit: { ...edit, page: next.page }, next, putBack: "whenOutOfOrder" };
}

/**
 * Another linked copy of `copy`'s shared section where a Ctrl/Cmd+Shift drag of `copy` dropped
 * (`drop`, F-ED-23): among the page's sections, between the Header and the Footer. A drop anywhere
 * else is refused.
 */
export function routeLinkedCopy(
  copy: NodeDoc & SharedCopyNode,
  drop: Drop,
  docs: CanvasDocs,
): RoutedEdit {
  const { page, layout, shared } = docs;
  const header = layout.header.length;
  const at = page.content.indexOf(copy);
  // Puck counts the drop without the copy that was dragged; the page still has it.
  if (drop.destinationZone !== ROOT_ZONE) {
    return refuse(docs);
  }
  const among = drop.destinationIndex - header;
  const others = Math.min(Math.max(among, 0), page.content.length - 1);
  const index = others >= at ? others + 1 : others;
  const added = newSharedCopy(page.content, copy.props.sharedSectionId, shared, layout);
  const content = [...page.content];
  content.splice(index, 0, added);
  const next = { ...docs, page: { ...page, content } };
  const root = shared[copy.props.sharedSectionId]?.section.props.id;
  const id = root === undefined ? null : copiedNodeId(added.props.id, root);
  return {
    emit: {
      kind: "duplicate",
      nodeId: id,
      componentType: SHARED_COPY_TYPE,
      field: null,
      page: next.page,
      selection: id,
      copyOf: copy.props.sharedSectionId,
    },
    next,
    putBack: "always",
  };
}
