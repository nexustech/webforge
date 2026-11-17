import { isNodeDoc, type NodeDoc } from "./documents.js";

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

/**
 * The node in `nodes` or their slots whose slot holds the node `id`, or undefined for one at the top
 * of `nodes` (a page's section), or one that isn't there.
 */
export function findParent(nodes: readonly NodeDoc[], id: string): NodeDoc | undefined {
  return findNode(nodes, (node) =>
    Object.values(node.props).some(
      (value) =>
        Array.isArray(value) && value.some((child) => isNodeDoc(child) && child.props.id === id),
    ),
  );
}

/**
 * Removes the node `id` from `nodes` or their slots; whether it was there. Only arrays of nodes are
 * slots: a list field's plain items (an FAQ's questions as data, menu links) are left alone.
 */
export function removeNode(nodes: NodeDoc[], id: string): boolean {
  const index = nodes.findIndex((node) => node.props.id === id);
  if (index !== -1) {
    nodes.splice(index, 1);
    return true;
  }
  return nodes.some((node) =>
    Object.values(node.props).some(
      (value) =>
        Array.isArray(value) &&
        value.length > 0 &&
        value.every(isNodeDoc) &&
        removeNode(value as NodeDoc[], id),
    ),
  );
}
