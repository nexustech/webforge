import type { LayoutDoc, NodeDoc, PageDoc } from "@webforge/model";
import { allNodes, findNode } from "./tree.js";

/** A site without a shared Header or Footer. */
export const EMPTY_LAYOUT: LayoutDoc = { header: [], footer: [] };

/**
 * The page as the canvas shows it (C5, F-ED-7): the shared Header, the page's own content, then the
 * shared Footer, in one list Puck can edit.
 */
export function composePage(page: PageDoc, layout: LayoutDoc): PageDoc {
  return { root: page.root, content: [...layout.header, ...page.content, ...layout.footer] };
}

const idsOf = (nodes: readonly NodeDoc[]) => new Set(nodes.map((node) => node.props.id));

/**
 * Splits a page as the canvas shows it back into the page's own content and the shared layout,
 * by the ids of `layout`'s nodes: the Header's and Footer's nodes go back to the layout wherever
 * Puck shows them, and anything else is the page's, in the order Puck shows it.
 */
export function splitPage(
  composed: PageDoc,
  layout: LayoutDoc,
): { page: PageDoc; layout: LayoutDoc } {
  const headerIds = idsOf(layout.header);
  const footerIds = idsOf(layout.footer);
  const header: NodeDoc[] = [];
  const footer: NodeDoc[] = [];
  const content: NodeDoc[] = [];
  for (const node of composed.content) {
    const id = node.props.id;
    (headerIds.has(id) ? header : footerIds.has(id) ? footer : content).push(node);
  }
  return { page: { root: composed.root, content }, layout: { header, footer } };
}

const asPage = (nodes: readonly NodeDoc[]): PageDoc => ({
  root: { props: {} },
  content: [...nodes],
});

/** Whether `id` is the Header's or Footer's own node, or an element inside one (F-ED-7). */
export function isShared(layout: LayoutDoc, id: string): boolean {
  return findNode(asPage([...layout.header, ...layout.footer]), id) !== undefined;
}

/** Whether two lists hold the same elements, at any depth, in the same order. */
export function sameNodes(a: readonly NodeDoc[], b: readonly NodeDoc[]): boolean {
  const left = allNodes(asPage(a));
  const right = allNodes(asPage(b));
  return (
    left.length === right.length &&
    left.every((node, index) => node.props.id === right[index]?.props.id)
  );
}

/** Whether `id` is the Header's or Footer's own top-level node. */
export function isSharedRegion(layout: LayoutDoc, id: string): boolean {
  return [...layout.header, ...layout.footer].some((node) => node.props.id === id);
}

/** Whether two pages list the same top-level nodes in the same order. */
export function sameOrder(a: PageDoc, b: PageDoc): boolean {
  return (
    a.content.length === b.content.length &&
    a.content.every((node, index) => node.props.id === b.content[index]?.props.id)
  );
}
