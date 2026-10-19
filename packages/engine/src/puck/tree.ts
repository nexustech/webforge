import type { NodeDoc, PageDoc } from "../canvas-engine.js";

/** Puck's id for the page's top-level list of sections. */
export const ROOT_ZONE = "root:default-zone";

function isNode(value: unknown): value is NodeDoc {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { type, props } = value as { type?: unknown; props?: { id?: unknown } };
  return typeof type === "string" && typeof props?.id === "string";
}

/** The slot arrays inside a node's props (e.g. a Section's `content`). */
function childLists(node: NodeDoc): NodeDoc[][] {
  return Object.values(node.props).filter(
    (value): value is NodeDoc[] => Array.isArray(value) && value.every(isNode),
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
  return Array.isArray(list) ? list.filter(isNode) : [];
}

/** The node at `index` of `zone`. */
export function nodeAt(
  page: PageDoc,
  zone: string | undefined,
  index: number,
): NodeDoc | undefined {
  return zoneContent(page, zone)[index];
}

/** Every node id in the page, in document order. */
export function allNodeIds(page: PageDoc): string[] {
  const ids: string[] = [];
  const visit = (nodes: readonly NodeDoc[]) => {
    for (const node of nodes) {
      ids.push(node.props.id);
      for (const list of childLists(node)) visit(list);
    }
  };
  visit(page.content);
  return ids;
}
