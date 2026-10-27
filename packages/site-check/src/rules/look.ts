import { type ColorRole, findUnderlinedText, TEXT_COLOR_CLASSES } from "@webforge/model";
import { AA_TEXT, contrastIssues, contrastRatio } from "@webforge/themes";
import { eachFieldValue, elementPlace, exportedPlaces, fieldKey } from "../fields.js";
import type { CheckRule, Finding } from "../types.js";

/** The theme colour each text colour mark's class shows (2.25): `text-secondary` → `secondary`. */
const MARK_COLORS = new Map(
  Object.values(TEXT_COLOR_CLASSES).flatMap((name) =>
    name === undefined ? [] : [[name, name.slice("text-".length) as ColorRole] as const],
  ),
);

/**
 * Colours that are hard to read together (WCAG AA, 2.1): the theme's pairs the Theme panel warns
 * about, and text coloured with a theme colour (2.25) that fails 4.5:1 on the page's background
 * (an Accent can pass as a heading's colour, 3:1, and fail as text). *Should fix* at most, never
 * *Must fix* (F-CHK-1): contrast is a guideline the owner may weigh.
 */
export const contrastRule: CheckRule = {
  id: "contrast",
  level: "should",
  check: (input) => {
    const { colors } = input.site.theme;
    const found: Finding[] = contrastIssues(input.site.theme).map((issue) => ({
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
    eachFieldValue(input, ["richtext"], (placed) => {
      if (typeof placed.value !== "string") return;
      for (const [, name = ""] of placed.value.matchAll(/<span class="(text-[a-z-]+)"/g)) {
        const role = MARK_COLORS.get(name);
        if (role === undefined) continue;
        const ratio = contrastRatio(colors[role], colors["base-100"]);
        if (ratio < AA_TEXT) {
          found.push({
            key: `${fieldKey(placed)}/${role}`,
            place: elementPlace(placed),
            values: { foreground: role, ratio: Math.floor(ratio * 100) / 100, required: AA_TEXT },
          });
          break;
        }
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
