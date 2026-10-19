import type { PageDoc } from "../canvas-engine.js";
import type { ComponentLibrary } from "../library.js";
import { allNodeIds, findNode } from "./tree.js";

/**
 * Ids of nodes whose rich-text values differ between `before` and `after` and whose editor the
 * user is not typing in. Their editors are remounted so they show the new value (see
 * `toPuckConfig`). The focused editor is left alone: remounting it would drop the caret, and Puck
 * syncs it once typing pauses.
 */
export function staleRichText(
  library: ComponentLibrary,
  before: PageDoc,
  after: PageDoc,
  frameDocument: Document | null,
): string[] {
  const focused = frameDocument?.activeElement?.closest("[data-puck-component]");
  return allNodeIds(after).filter((id) => {
    const node = findNode(after, id);
    const fields = node === undefined ? undefined : library.components[node.type]?.fields;
    if (node === undefined || fields === undefined) {
      return false;
    }
    if (focused?.getAttribute("data-puck-component") === id) {
      return false;
    }
    const previous = findNode(before, id);
    return Object.entries(fields).some(
      ([name, field]) => field.kind === "richtext" && previous?.props[name] !== node.props[name],
    );
  });
}
