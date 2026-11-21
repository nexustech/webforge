import type { EnginePatch } from "@webforge/engine";
import {
  clearEditedExamples,
  elementsAt,
  exampleFields,
  findNode,
  isNodeDoc,
  type NodeDoc,
  type PageDoc,
  type SiteDoc,
} from "@webforge/model";

type Path = readonly (string | number)[];

/** Where the node with `id` sits in `page`, e.g. `["content", 2, "props", "content", 0]`. */
function nodePath(page: PageDoc, id: string): Path | undefined {
  const search = (list: readonly NodeDoc[], path: Path): Path | undefined => {
    for (const [index, node] of list.entries()) {
      if (node.props.id === id) {
        return [...path, index];
      }
      for (const [name, value] of Object.entries(node.props)) {
        if (Array.isArray(value) && value.every(isNodeDoc)) {
          const found = search(value, [...path, index, "props", name]);
          if (found !== undefined) {
            return found;
          }
        }
      }
    }
    return undefined;
  };
  return search(page.content, ["content"]);
}

/**
 * Sets one field of the node `nodeId` in `draft`, an Immer draft of `page`, to what `next` makes of
 * the field's current value. The node is looked up in the plain `page`, so only the drafts along its
 * path are created: the Immer patches and the work stay as small as the edit, whatever the size of
 * the page (ADR 0007). Returns false if the node isn't in the page.
 */
export function updateField(
  draft: PageDoc,
  page: PageDoc,
  nodeId: string,
  field: string,
  next: (current: unknown) => unknown,
): boolean {
  const path = nodePath(page, nodeId);
  if (path === undefined) {
    return false;
  }
  let target: unknown = draft;
  for (const key of path) {
    target = (target as Record<string | number, unknown>)[key];
  }
  const { props } = target as NodeDoc;
  const before = props[field];
  const after = next(before);
  props[field] = after;
  // Editing a text marked as an example clears its mark, in the same step (#1228, WN-3).
  clearEditedExamples(props, field, before, after);
  return true;
}

/**
 * Applies a single-field edit to `draft`, an Immer draft of `page` (see {@link updateField}).
 * Returns false if the node isn't in the page; the caller then records the edit some other way.
 */
export function applyPatch(draft: PageDoc, page: PageDoc, patch: EnginePatch): boolean {
  return updateField(draft, page, patch.nodeId, patch.field, () => patch.value);
}

/** A node a canvas edit reaches that has a mark on the edited field: where, and its value before. */
export type MarkedEdit = { readonly on: string; readonly before: unknown };

/** Whether the node with `props` has a mark on `field`, or on one of its list's items. */
const markedOn = (props: NodeDoc["props"], field: string) =>
  exampleFields(props).some((key) => key === field || key.startsWith(`${field}.`));

/**
 * Where the node `nodeId` is kept, if its `field`, or an item of its list, is marked as an example
 * (#1228, WN-3), and the field's value before the edit: what a canvas edit of it clears the marks
 * of, in the same step. Looked for in `site` as it is, not in a draft, so editing a node with no
 * mark makes no drafts along the way (ADR 0007).
 */
export function markedPlaceOf(
  site: SiteDoc,
  first: string,
  nodeId: string,
  field: string,
): MarkedEdit | undefined {
  const places = [
    first,
    "header",
    "footer",
    ...Object.keys(site.sharedSections),
    ...Object.keys(site.collections),
  ];
  for (const on of places) {
    const node = findNode(elementsAt(site, on), (each) => each.props.id === nodeId);
    if (node !== undefined) {
      return markedOn(node.props, field) ? { on, before: node.props[field] } : undefined;
    }
  }
  return undefined;
}

/**
 * Clears the marks the edit of `field` on the node `nodeId` edited, once it's written in `draft`
 * (see {@link markedPlaceOf}): the field's own, or each list item's whose text changed. After the
 * write, which may have copied the canvas's tree, marks and all.
 */
export function clearEditedIn(
  draft: SiteDoc,
  marked: MarkedEdit,
  nodeId: string,
  field: string,
): void {
  const node = findNode(elementsAt(draft, marked.on), (each) => each.props.id === nodeId);
  if (node !== undefined) clearEditedExamples(node.props, field, marked.before, node.props[field]);
}
