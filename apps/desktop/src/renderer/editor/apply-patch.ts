import type { EnginePatch } from "@webforge/engine";
import { isNodeDoc, type NodeDoc, type PageDoc } from "@webforge/model";

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
 * Applies a single-field edit to `draft` (an Immer draft of `page`). The node is looked up in `page` (the document the draft
 * was made from), so only the drafts along its path are created: the Immer patches and the work
 * stay as small as the edit, whatever the size of the page (ADR 0007).
 * Returns false if the node isn't in the page; the caller then records the edit some other way.
 */
export function applyPatch(draft: PageDoc, page: PageDoc, patch: EnginePatch): boolean {
  const path = nodePath(page, patch.nodeId);
  if (path === undefined) {
    return false;
  }
  let target: unknown = draft;
  for (const key of path) {
    target = (target as Record<string | number, unknown>)[key];
  }
  (target as NodeDoc).props[patch.field] = patch.value;
  return true;
}
