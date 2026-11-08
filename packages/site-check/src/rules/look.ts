import {
  type ColorRole,
  findUnderlinedText,
  type NodeDoc,
  type Responsive,
  resolveResponsive,
  TEXT_COLOR_CLASSES,
  valuesWithLook,
} from "@webforge/model";
import { drawsPictureBehind, textStylesIn } from "@webforge/site-components/catalogue-data";
import {
  AA_LARGE,
  AA_TEXT,
  contrastIssues,
  contrastNeeded,
  contrastRatio,
  resolveColorRef,
  type Surface,
  surfaceOf,
} from "@webforge/themes";
import {
  eachFieldValue,
  elementPlace,
  exportedPlaces,
  fieldKey,
  type PlacedValue,
} from "../fields.js";
import type { CheckInput, CheckRule, Finding } from "../types.js";

/** The theme colour each text colour mark's class shows (2.25): `text-secondary` → `secondary`. */
const MARK_COLORS = new Map(
  Object.values(TEXT_COLOR_CLASSES).flatMap((name) =>
    name === undefined ? [] : [[name, name.slice("text-".length) as ColorRole] as const],
  ),
);

/**
 * The fields that colour an element's text, which the rule measures (#670): on a graphic component
 * (an Icon, Social links), its drawing, measured as a graphic.
 */
const TEXT_COLOUR_FIELDS = new Set(["color", "lookColor", "lookTitleColor"]);

/**
 * What `placed`'s text is drawn on: its section's colours and the nearest background, or a picture
 * one of them draws behind its content, as the catalogue says (#670).
 */
function surfaceUnder(
  { site, catalogue }: CheckInput,
  placed: Pick<PlacedValue, "ancestors" | "node">,
): Surface {
  const { looks } = site.theme;
  const nodes: readonly NodeDoc[] = [...placed.ancestors, placed.node];
  const chain = nodes.map((node) => valuesWithLook(node.props, looks?.[node.type]));
  return surfaceOf(site.theme, chain, (at) => {
    const component = catalogue[nodes[at]?.type ?? ""];
    const values = chain[at];
    return component !== undefined && values !== undefined && drawsPictureBehind(component, values);
  });
}

/**
 * Colours that are hard to read together (WCAG AA, 2.1): the theme's pairs the Theme panel warns
 * about; text coloured with a theme colour (2.25) that fails 4.5:1; and an element's text colour
 * (a Heading's colour, Appearance's text colour, a section's title colour) that fails what text of
 * its size needs, as the colour field measures it: 3:1 for a large heading, 4.5:1 for other text.
 * A graphic component's colour (an Icon's, Social links' logos) needs 3:1, as graphics do (WCAG
 * 1.4.11), whatever its field is called. Each is measured on what the text is drawn on, a Reversed
 * section's colours or an Appearance background (#670). Nothing is measured over a picture drawn
 * behind the content (a section's background image, a Hero's in its background layout), whose
 * colours can't be known. Site Check has no rule for those: the Edit panel's overlay field warns
 * when a section's text is hard to read over its background image (2.26, `overlay-warning.ts`).
 * *Should fix* at most, never *Must fix* (F-CHK-1): contrast is a guideline the owner may weigh.
 */
export const contrastRule: CheckRule = {
  id: "contrast",
  level: "should",
  check: (input) => {
    const { theme } = input.site;
    const found: Finding[] = contrastIssues(theme).map((issue) => ({
      key: `${issue.palette}/${issue.background}/${issue.foreground}`,
      place: { kind: "theme" },
      values: {
        palette: issue.palette,
        background: issue.background,
        foreground: issue.foreground,
        ratio: issue.ratio,
        required: issue.required,
      },
    }));
    // One walk for both: rich text's colour marks, and the fields that colour text.
    const marks = (placed: PlacedValue) => {
      if (typeof placed.value !== "string") return;
      let surface: Surface | undefined;
      for (const [, name = ""] of placed.value.matchAll(/<span class="(text-[a-z-]+)"/g)) {
        const role = MARK_COLORS.get(name);
        if (role === undefined) continue;
        surface ??= surfaceUnder(input, placed);
        if (surface.overPicture) return;
        const shown = resolveColorRef(theme, role, surface.palette);
        if (shown === undefined) continue;
        const ratio = contrastRatio(shown.color, surface.background);
        if (ratio < AA_TEXT) {
          found.push({
            key: `${fieldKey(placed)}/${role}`,
            place: elementPlace(placed),
            values: { foreground: role, ratio: Math.floor(ratio * 100) / 100, required: AA_TEXT },
          });
          break;
        }
      }
    };
    eachFieldValue(input, ["richtext", "color"], (placed) => {
      if (!TEXT_COLOUR_FIELDS.has(placed.field)) {
        // A colour field's value is never rich text: only rich text has marks to read.
        marks(placed);
        return;
      }
      // As the desktop shows it, where most pages are read.
      const ref = resolveResponsive(placed.value as Responsive<unknown>, "desktop");
      if (typeof ref !== "string") return;
      const surface = surfaceUnder(input, placed);
      if (surface.overPicture) return;
      const shown = resolveColorRef(theme, ref, surface.palette);
      if (shown === undefined) return;
      const ratio = contrastRatio(shown.color, surface.background, shown.opacity);
      const component = input.catalogue[placed.node.type];
      // By the component's kind, not the field's name: an Icon's colour is a drawing's.
      const graphic = component?.graphic === true && placed.field !== "lookTitleColor";
      // A section's title is set as one; an element's text as its kind sets it.
      const required = graphic
        ? AA_LARGE
        : contrastNeeded(
            theme,
            placed.field === "lookTitleColor"
              ? ["h2"]
              : component === undefined
                ? []
                : textStylesIn(component, {
                    ...component.defaults,
                    ...valuesWithLook(placed.node.props, theme.looks?.[placed.node.type]),
                  }),
          );
      if (ratio < required) {
        const values = { foreground: ref, ratio: Math.floor(ratio * 100) / 100, required };
        found.push({
          key: fieldKey(placed),
          place: elementPlace(placed),
          // An icon's or a logo's: the panel says so, as it needs less than text.
          values: graphic ? { ...values, drawn: "graphic" } : values,
        });
      }
    });
    return found;
  },
};

/** Whether `value`, an Appearance toggle's value, is on for any device. */
function onForAnyDevice(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== "object" || value === null || !("$responsive" in value)) return false;
  return Object.values(value.$responsive as Record<string, unknown>).some((each) => each === true);
}

/**
 * Underlined text that isn't a link (2.25, ST-3), which visitors take for one: in rich text, or a
 * whole element underlined in its Appearance (2.22) on any device, unless it's a link itself (a
 * Button). A tip; it never blocks publishing.
 */
export const underlinedTextRule: CheckRule = {
  id: "underlinedText",
  level: "tip",
  check: (input) => {
    const { site, catalogue } = input;
    const found = new Map<string, Finding>();
    const exported = exportedPlaces(site);
    for (const { on, nodeId } of findUnderlinedText(site, { skipHidden: true })) {
      if (!exported(on)) continue;
      found.set(`${on}/${nodeId}`, {
        key: `${on}/${nodeId}`,
        place: { kind: "element", on, nodeId },
      });
    }
    eachFieldValue(input, ["toggle"], (placed) => {
      if (placed.field !== "lookUnderline" || !onForAnyDevice(placed.value)) return;
      const fields = Object.values(catalogue[placed.node.type]?.fields ?? {});
      if (fields.some((field) => field.kind === "link")) return;
      const key = `${placed.on}/${placed.node.props.id}`;
      if (!found.has(key)) found.set(key, { key, place: elementPlace(placed) });
    });
    return [...found.values()];
  },
};
