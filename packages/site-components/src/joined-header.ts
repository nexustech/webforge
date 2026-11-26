import type { NodeDoc } from "@webforge/model";
import { appearanceColourClasses } from "./appearance.js";
import { backgroundText } from "./background.js";
import { type ComponentLibrary, withLook } from "./library.js";
import type { JoinedHeader, RenderContext } from "./schema.js";

/** The Header's type, in the site's layout (C5). */
const HEADER = "Header";

/**
 * The page's Header joined to its first section (HH-1), from the Header it shows (`header`, the
 * page's Header region: empty where Page Settings hide it) and its `content`: where the Header's
 * **Background** is *The first section's* and the page has a section shown. That's the first shown
 * after the Header, where the canvas draws a Blog's design between it and a post (6.10a), else the
 * content's first. The section's colours
 * (its reversed ones, 2.4) and the classes that set its text colour come with it, as the section
 * draws them: the person's Colour (Appearance, per device), else its frame's for its layout or its
 * background image's overlay. The export's pages and the canvas both take it from here.
 */
export function joinedHeaderOf(
  regions: { readonly header: readonly NodeDoc[]; readonly content: readonly NodeDoc[] },
  library: ComponentLibrary,
  looks?: RenderContext["looks"],
): JoinedHeader | undefined {
  const at = regions.header.findIndex((node) => node.type === HEADER && node.props.hidden !== true);
  const header = regions.header[at];
  if (header === undefined) return undefined;
  const headerDef = library.components[HEADER];
  const background =
    withLook(header.props, HEADER, looks).background ?? headerDef?.defaults?.background;
  if (background !== "section") return undefined;
  const shown = (node: NodeDoc) => node.props.hidden !== true;
  const first = regions.header.slice(at + 1).find(shown) ?? regions.content.find(shown);
  const def = first === undefined ? undefined : library.components[first.type];
  if (first === undefined || def === undefined || typeof first.props.id !== "string") {
    return undefined;
  }
  const values: Readonly<Record<string, unknown>> = {
    ...def.defaults,
    ...withLook(first.props, first.type, looks),
  };
  const drawn = def.sectionText?.(values) ?? backgroundText(values);
  const text = [drawn === undefined ? "" : `text-${drawn}`, appearanceColourClasses(values)]
    .filter((part) => part !== "")
    .join(" ");
  return { section: first.props.id, inverse: values.colors === "inverse", text };
}
