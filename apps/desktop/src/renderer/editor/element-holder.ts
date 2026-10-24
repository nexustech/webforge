import { isNodeDoc, type NodeDoc, type PageId, type SiteDoc } from "@webforge/model";
import type { EditorSession } from "./editor-session.js";
import { fieldTarget } from "./field-target.js";

/** The element of type `holder` that has `childId` among its slots' elements, among `nodes`. */
function holding(nodes: readonly NodeDoc[], holder: string, childId: string): NodeDoc | undefined {
  for (const node of nodes) {
    for (const value of Object.values(node.props)) {
      if (!Array.isArray(value) || !value.every(isNodeDoc)) continue;
      if (node.type === holder && value.some((child) => child.props.id === childId)) return node;
      const found = holding(value, holder, childId);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/**
 * The `holder` element (a List, a Columns) that `nodeId` is, or that holds it if it is one of its
 * `child` elements (a List item, a Column), by the id the canvas shows it by: on the page, in the
 * shared Header or Footer, or in a linked copy (`copy~id`, F-ED-23). `childId` is the child's own
 * id, when `nodeId` is one. A contextual toolbar uses it to work on the holder whichever is selected.
 */
export function holderOf(
  site: SiteDoc,
  session: Pick<EditorSession, "library">,
  pageId: PageId,
  nodeId: string,
  holder: string,
  child: string,
): { readonly holderId: string; readonly childId: string | undefined } | undefined {
  const node = fieldTarget(site, session.library, pageId, nodeId)?.node;
  if (node?.type === holder) return { holderId: nodeId, childId: undefined };
  if (node?.type !== child) return undefined;
  const split = nodeId.lastIndexOf("~");
  const prefix = nodeId.slice(0, split + 1);
  const own = nodeId.slice(split + 1);
  const trees = [
    site.pages[pageId]?.doc.content ?? [],
    site.layout.header,
    site.layout.footer,
    ...Object.values(site.sharedSections).map((shared) => [shared.section]),
  ];
  for (const tree of trees) {
    const found = holding(tree, holder, own);
    if (found !== undefined) return { holderId: `${prefix}${found.props.id}`, childId: own };
  }
  return undefined;
}
