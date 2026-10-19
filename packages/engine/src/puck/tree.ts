import { isNodeDoc, type NodeDoc, type PageDoc } from "@webforge/model";

/** Puck's id for the page's top-level list of sections. */
export const ROOT_ZONE = "root:default-zone";

/** The slot arrays inside a node's props (e.g. a Section's `content`). */
function childLists(node: NodeDoc): NodeDoc[][] {
  return Object.values(node.props).filter(
    (value): value is NodeDoc[] => Array.isArray(value) && value.every(isNodeDoc),
  );
}

/** Finds a node anywhere in the page by id. */
export function findNode(page: PageDoc, id: string): NodeDoc | undefined {
  const stack = [...page.content];
  for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
    if (node.props.id === id) {
      return node;
    }
    stack.push(...childLists(node).flat());
  }
  return undefined;
}

/** The list of nodes a Puck zone (`<parentId>:<slot>`) refers to. */
export function zoneContent(page: PageDoc, zone: string = ROOT_ZONE): readonly NodeDoc[] {
  if (zone === ROOT_ZONE) {
    return page.content;
  }
  const separator = zone.lastIndexOf(":");
  const parent = findNode(page, zone.slice(0, separator));
  const list = parent?.props[zone.slice(separator + 1)];
  return Array.isArray(list) ? list.filter(isNodeDoc) : [];
}

/** The node at `index` of `zone`. */
export function nodeAt(
  page: PageDoc,
  zone: string | undefined,
  index: number,
): NodeDoc | undefined {
  return zoneContent(page, zone)[index];
}

/** Every node in the page, in document order. */
export function allNodes(page: PageDoc): NodeDoc[] {
  const nodes: NodeDoc[] = [];
  const visit = (list: readonly NodeDoc[]) => {
    for (const node of list) {
      nodes.push(node);
      for (const children of childLists(node)) visit(children);
    }
  };
  visit(page.content);
  return nodes;
}
