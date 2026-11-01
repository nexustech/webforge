import { isNodeDoc, type NodeDoc, type SiteDoc } from "@webforge/model";
import type { ComponentLibrary } from "./library.js";
import { sanitizeStoredRichText } from "./rich-text-html.js";

/** `node` with its rich text cleaned, slots included; `node` itself when nothing changed. */
function cleanNode(node: NodeDoc, library: ComponentLibrary): NodeDoc {
  const fields = library.components[node.type]?.fields ?? {};
  let changed = false;
  const props = Object.fromEntries(
    Object.entries(node.props).map(([name, value]) => {
      const cleaned =
        fields[name]?.kind === "richtext" && typeof value === "string"
          ? sanitizeStoredRichText(value)
          : Array.isArray(value) && value.length > 0 && value.every(isNodeDoc)
            ? withCleanRichText(value, library)
            : value;
      if (cleaned !== value) changed = true;
      return [name, cleaned];
    }),
  );
  return changed ? { type: node.type, props: props as NodeDoc["props"] } : node;
}

/**
 * `nodes` with their rich text cleaned as {@link sanitizeStoredRichText} does, in their slots too
 * (S23): rich text from a site file or the clipboard isn't trusted to be what the editor wrote,
 * as Puck draws some of it as it is. `nodes` itself, and each node, where nothing changed.
 */
export function withCleanRichText(nodes: NodeDoc[], library: ComponentLibrary): NodeDoc[] {
  const cleaned = nodes.map((node) => cleanNode(node, library));
  return cleaned.every((node, index) => node === nodes[index]) ? nodes : cleaned;
}

/**
 * `site` with the rich text of every element cleaned (S23), on its pages, in its Header and
 * Footer and in its shared sections: `site` itself, and each part, where nothing changed, so an
 * opened file that needs nothing cleaned is never written.
 */
export function siteWithCleanRichText(site: SiteDoc, library: ComponentLibrary): SiteDoc {
  const header = withCleanRichText(site.layout.header, library);
  const footer = withCleanRichText(site.layout.footer, library);
  let changed = header !== site.layout.header || footer !== site.layout.footer;
  const pages = Object.fromEntries(
    Object.entries(site.pages).map(([id, page]) => {
      const content = withCleanRichText(page.doc.content, library);
      if (content === page.doc.content) return [id, page];
      changed = true;
      return [id, { ...page, doc: { ...page.doc, content } }];
    }),
  ) as SiteDoc["pages"];
  const sharedSections = Object.fromEntries(
    Object.entries(site.sharedSections).map(([id, entry]) => {
      const section = cleanNode(entry.section, library);
      if (section === entry.section) return [id, entry];
      changed = true;
      return [id, { ...entry, section }];
    }),
  ) as SiteDoc["sharedSections"];
  return changed
    ? { ...site, layout: { ...site.layout, header, footer }, pages, sharedSections }
    : site;
}
