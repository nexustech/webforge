import { DOCUMENT_EXTENSIONS, isNodeDoc, type NodeDoc, type SiteSnapshot } from "@webforge/model";
import { type ComponentLibrary, renderNodesToHtml } from "@webforge/site-components";
import { pagePrefix, pageRender } from "./export-context.js";
import { formatHtml } from "./html.js";
import { plannedImage } from "./images.js";
import { withThanksPage } from "./thanks-page.js";

/** The node `id` among `nodes`, at any depth. */
function findNode(nodes: readonly NodeDoc[], id: string): NodeDoc | undefined {
  return locate(nodes, id)?.node;
}

/**
 * The node `id` among `nodes`, at any depth, and whether the export leaves it out: hidden in Layers
 * (F-ED-12), itself or inside something that is.
 */
function locate(
  nodes: readonly NodeDoc[],
  id: string,
  inHidden = false,
): { readonly node: NodeDoc; readonly hidden: boolean } | undefined {
  for (const node of nodes) {
    const hidden = inHidden || node.props.hidden === true;
    if (node.props.id === id) return { node, hidden };
    for (const value of Object.values(node.props)) {
      if (!Array.isArray(value)) continue;
      const found = locate(value.filter(isNodeDoc), id, hidden);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/**
 * Item `nodeId` on page `pageId` (in its content, or the Header or Footer it shows) as the export
 * writes it, readable as the export's HTML is (X4): Advanced mode's CSS tab (3.14). It renders with
 * the export's own context (`pageRender`), so links, the menu, bindings, looks and Custom Code are
 * the export's. Images are named and sized from their size in Media (`sizes`, by Media id; see
 * `plannedImage`), as nothing is encoded here. `""` for an item the export leaves out: hidden in
 * Layers, itself or inside something that is, or in a Header or Footer the page hides; `undefined`
 * when the page or the item isn't there.
 */
export function itemHtml(
  snapshot: SiteSnapshot,
  library: ComponentLibrary,
  sizes: ReadonlyMap<string, { readonly width: number; readonly height: number }>,
  pageId: string,
  nodeId: string,
): string | undefined {
  const { site, thanksPage } = withThanksPage(snapshot, library);
  const page = site.pages.find((each) => each.id === pageId);
  if (page === undefined) return undefined;
  // Where the item is, as the site keeps it: in a Header or Footer the page hides, or hidden
  // itself or inside something hidden, the export writes nothing of it.
  const header = locate(site.layout.header, nodeId);
  const footer = locate(site.layout.footer, nodeId);
  const where = header ?? locate(page.doc.content, nodeId) ?? footer;
  if (where === undefined) return undefined;
  const leftOut =
    where.hidden ||
    (header !== undefined && page.hideHeader === true) ||
    (where === footer && page.hideFooter === true);
  if (leftOut) return "";
  const images = new Map(
    site.media.flatMap((item) => {
      const size = sizes.get(item.id);
      return size === undefined ? [] : [[item.id, plannedImage(item, size)] as const];
    }),
  );
  const documentPaths = new Map(
    (site.documents ?? []).map((item) => [
      item.id as string,
      `files/${item.name}.${DOCUMENT_EXTENSIONS[item.mimeType]}`,
    ]),
  );
  const { context, regions } = pageRender(site, page, pagePrefix(page, "/"), {
    images,
    missing: new Set(),
    documentPaths,
    bundled: site.code?.bundled ?? [],
    thanksPage,
    cookieSettings: site.analytics?.consentBanner === true,
  });
  const node = findNode([...regions.header, ...regions.content, ...regions.footer], nodeId);
  if (node === undefined) return undefined;
  // As `renderPage` renders the content: its first section's picture loads first (3.15, SEO-4).
  const first = regions.content.find((each) => each.props.hidden !== true)?.props.id;
  const html = renderNodesToHtml(
    [node],
    library,
    typeof first === "string" ? { ...context, firstSection: first } : context,
  );
  return html === "" ? "" : formatHtml(html);
}
