import type { NodeDoc, PageDoc } from "../canvas-engine.js";
import type { ComponentLibrary } from "../library.js";
import { allNodes } from "./tree.js";

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
  const focusedId = frameDocument?.activeElement
    ?.closest("[data-puck-component]")
    ?.getAttribute("data-puck-component");
  const previous = new Map<string, NodeDoc>(allNodes(before).map((node) => [node.props.id, node]));
  return allNodes(after)
    .filter((node) => {
      const fields = library.components[node.type]?.fields;
      if (fields === undefined || node.props.id === focusedId) {
        return false;
      }
      const old = previous.get(node.props.id);
      return Object.entries(fields).some(
        ([name, field]) => field.kind === "richtext" && old?.props[name] !== node.props[name],
      );
    })
    .map((node) => node.props.id);
}
