import type { NodeDoc } from "@webforge/model";
import { appearanceColourClasses, backgroundColoursOf, hasOwnBackground } from "./appearance.js";
import { backgroundText, hasBackground, overlayOf } from "./background.js";
import { type ComponentLibrary, withLook } from "./library.js";
import { drawsPictureBehind } from "./picture-behind.js";
import type { DarkGrounds, JoinedHeader, RenderContext } from "./schema.js";

/** The Header's type, in the site's layout (C5). */
const HEADER = "Header";

/**
 * The page's Header joined to its first section (HH-1), from the Header it shows (`header`, the
 * page's Header region: empty where Page Settings hide it) and its `content`: where the Header's
 * **Background** is *The first section's* and the page has a section shown. That's the first shown
 * after the Header, where the canvas draws a Blog's design between it and a post (6.10a), else the
 * content's first, unless it draws on the page's own colours, where the Header keeps its band, as
 * it looks the same. The section's colours
 * (its reversed ones, 2.4) and the classes that set its text colour come with it, as the section
 * draws them: the person's Colour (Appearance, per device), else its frame's for its layout or its
 * background image's overlay. And the colours it sits on (HH-2), for the logo it shows. The export's
 * pages and the canvas both take it from here.
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
  const inverse = values.colors === "inverse";
  // On the page's own colours the Header looks as it does with its own background: it keeps it.
  const ground = def.sectionGround?.(values);
  // A picture behind its content, as a Hero draws one, whatever colour its overlay is (HH-3).
  const picture = hasBackground(values) || drawsPictureBehind(def, values);
  if (
    !inverse &&
    (ground === undefined || ground === "base-100") &&
    !picture &&
    !hasOwnBackground(values)
  ) {
    return undefined;
  }
  const drawn = def.sectionText?.(values) ?? backgroundText(values);
  const text = [drawn === undefined ? "" : `text-${drawn}`, appearanceColourClasses(values)]
    .filter((part) => part !== "")
    .join(" ");
  return { section: first.props.id, inverse, text, grounds: groundsOf(values, picture, ground) };
}

/**
 * The colours a joined Header sits on (HH-2), from the top layer down: a picture's overlay, whose
 * colour the text takes too (a photo's own colours can't be known); else the person's background
 * or gradient on each device; else the section's own colour, `ground`, or the page's.
 */
function groundsOf(
  values: Readonly<Record<string, unknown>>,
  picture: boolean,
  ground: string | undefined,
): readonly string[] {
  if (picture) return [overlayOf(values).color === "neutral" ? "neutral" : "base-100"];
  const own = ground ?? "base-100";
  const each = backgroundColoursOf(values).flatMap((colours) =>
    colours.length === 0 ? [own] : colours,
  );
  return [...new Set(each)];
}

/**
 * Whether every one of `grounds` is dark (HH-2): one of the theme's dark colours, `dark`, in its
 * reversed colours where `inverse` is set. A colour at an opacity counts as the colour. None is dark
 * without `dark`, or without a ground.
 */
export function onDarkGround(
  grounds: readonly string[],
  inverse: boolean,
  dark: DarkGrounds | undefined,
): boolean {
  if (dark === undefined || grounds.length === 0) return false;
  const colours = inverse ? dark.inverse : dark.colors;
  return grounds.every((ground) => colours.includes(ground.split("/")[0] ?? ground));
}
