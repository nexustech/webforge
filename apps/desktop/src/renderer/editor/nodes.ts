import { isNodeDoc, type NodeDoc } from "@webforge/model";

/** The first node in `nodes` or their slots, in document order, that `matches`. */
export function findNode(
  nodes: readonly NodeDoc[],
  matches: (node: NodeDoc) => boolean,
): NodeDoc | undefined {
  for (const node of nodes) {
    if (matches(node)) {
      return node;
    }
    for (const value of Object.values(node.props)) {
      const found = Array.isArray(value) ? findNode(value.filter(isNodeDoc), matches) : undefined;
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}
