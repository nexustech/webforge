import type { NodeDoc, SiteSnapshot } from "@webforge/model";
import { serviceFormLabel } from "@webforge/site-components";

const isNode = (value: unknown): value is NodeDoc =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { type?: unknown }).type === "string" &&
  typeof (value as { props?: unknown }).props === "object";

/**
 * Each form's name in Netlify Forms, by its element's id (4.2), for a build for Netlify: its label
 * ("Contact form", a Form's own), and " 2", " 3" for later forms with the same one. Netlify keeps
 * one list of fields, and one inbox, per name, so two different forms must never share one. In a
 * stable order (the Header, each page's content in the site's order, then the Footer, each element
 * in its order and its slots' in theirs), so publishing again keeps each form's name. Hidden forms,
 * which the export leaves out, get none.
 */
export function netlifyFormNames(site: SiteSnapshot): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  const used = new Map<string, number>();
  const visit = (nodes: readonly NodeDoc[]) => {
    for (const node of nodes) {
      if (node.props.hidden === true) continue;
      const label = serviceFormLabel(node);
      const id = node.props.id;
      if (label !== undefined && typeof id === "string" && !names.has(id)) {
        const count = (used.get(label) ?? 0) + 1;
        used.set(label, count);
        names.set(id, count === 1 ? label : `${label} ${count}`);
      }
      for (const value of Object.values(node.props)) {
        if (Array.isArray(value)) visit(value.filter(isNode));
      }
    }
  };
  visit(site.layout.header);
  for (const page of site.pages) visit(page.doc.content);
  visit(site.layout.footer);
  return names;
}
