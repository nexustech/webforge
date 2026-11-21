import type { EnginePatch } from "@webforge/engine";
import {
  clearEditedExamples,
  clearExample,
  elementsAt,
  findNode,
  isExample,
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

/**
 * Where the node `nodeId` is kept, if its `field` is marked as an example (#1228, WN-3): the place
 * (a page, the Header or Footer, a shared section, a Blog's design) a canvas edit of that text
 * clears it in. Looked for in `site` as it is, not in a draft, so editing a text with no mark makes
 * no drafts along the way (ADR 0007).
 */
export function markedPlaceOf(
  site: SiteDoc,
  first: string,
  nodeId: string,
  field: string,
): string | undefined {
  const places = [
    first,
    "header",
    "footer",
    ...Object.keys(site.sharedSections),
    ...Object.keys(site.collections),
  ];
  for (const on of places) {
    const node = findNode(elementsAt(site, on), (each) => each.props.id === nodeId);
    if (node !== undefined) return isExample(node.props, field) ? on : undefined;
  }
  return undefined;
}

/** Clears `field`'s mark on the node `nodeId` kept `on` in `draft` (see {@link markedPlaceOf}). */
export function clearMarkIn(draft: SiteDoc, on: string, nodeId: string, field: string): void {
  const node = findNode(elementsAt(draft, on), (each) => each.props.id === nodeId);
  if (node !== undefined) clearExample(node.props, field);
}
