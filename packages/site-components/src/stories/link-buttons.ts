import { hasLink, isNodeDoc, type NodeDoc } from "@webforge/model";
import { siteLibrary } from "../catalogue/index.js";

/**
 * `doc` with a link on each button that has none, its items' and slots' too. A button without one
 * is left out of the export (#1256), and stories that show a component's or a theme's buttons
 * draw from its defaults, which have none.
 */
export function linkButtons(doc: NodeDoc): NodeDoc {
  const fields = siteLibrary.components[doc.type]?.fields ?? {};
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc.props)) {
    props[key] = Array.isArray(value)
      ? value.map((item: unknown) => (isNodeDoc(item) ? linkButtons(item) : item))
      : value;
  }
  for (const [key, field] of Object.entries(fields)) {
    if (field.kind === "link" && field.button !== undefined && !hasLink(props[key])) {
      props[key] = "about";
    }
  }
  return { ...doc, props: { ...props, id: doc.props.id } };
}
