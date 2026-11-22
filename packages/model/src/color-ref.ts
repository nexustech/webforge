import { z } from "zod";
import {
  COLOR_ROLES,
  type ColorRole,
  OPACITY_STEPS,
  OWN_COLOR_ID_PATTERN,
  SHADE_STEPS,
  SHADED_ROLES,
  type ShadeStep,
} from "./theme.js";

/**
 * A colour a style field uses (2.1, 1.37): `<base>[-<shade>][/<opacity>]`, read as Tailwind reads a
 * class's colour (`bg-primary-300/80`). The base is a theme role, with shades for the colour roles
 * only; one of the person's own colours in the theme (`own-<id>`, TC-1a, #1217), with shades as the
 * colour roles have them; or a colour of the field's own as a Tailwind arbitrary value
 * (`[#1f6feb]`, ADR 0009), which theme changes leave as it is.
 */
export type ColorRef = {
  /**
   * A role; one of the theme's own colours, by its id; or a colour of the field's own as six
   * lower-case hex digits (`#1f6feb`).
   */
  readonly base: { readonly role: ColorRole } | { readonly own: string } | { readonly hex: string };
  readonly shade?: ShadeStep;
  /** In percent; none means opaque. */
  readonly opacity?: (typeof OPACITY_STEPS)[number];
};

/** What a reference to one of the theme's own colours starts with: `own-<id>`. */
export const OWN_COLOR_PREFIX = "own-";

const SHADES = SHADE_STEPS.join("|");
const OPACITIES = OPACITY_STEPS.join("|");
const ROLES = [...COLOR_ROLES].sort((a, b) => b.length - a.length).join("|");
const SHADED = SHADED_ROLES.join("|");
// Only six hex digits fit between the brackets, and an own colour's id is letters and digits only,
// so nothing else can reach the class or the CSS.
const PATTERN = new RegExp(
  `^(?:(?<shaded>${SHADED})(?:-(?<shade>${SHADES}))?|${OWN_COLOR_PREFIX}(?<own>${OWN_COLOR_ID_PATTERN})(?:-(?<ownShade>${SHADES}))?|(?<role>${ROLES})|\\[(?<hex>#[0-9a-fA-F]{6})\\])(?:/(?<opacity>${OPACITIES}))?$`,
);

/** What `ref` names, or undefined if it isn't a colour ref. A hex colour comes back lower case. */
export function parseColorRef(ref: string): ColorRef | undefined {
  const groups = PATTERN.exec(ref)?.groups;
  if (groups === undefined) return undefined;
  const base =
    groups.hex !== undefined
      ? { hex: groups.hex.toLowerCase() }
      : groups.own !== undefined
        ? { own: groups.own }
        : { role: (groups.shaded ?? groups.role) as ColorRole };
  const shade = groups.shade ?? groups.ownShade;
  return {
    base,
    ...(shade === undefined ? {} : { shade: Number(shade) as ShadeStep }),
    ...(groups.opacity === undefined
      ? {}
      : { opacity: Number(groups.opacity) as (typeof OPACITY_STEPS)[number] }),
  };
}

/**
 * `ref` written out, as a style field stores it and a class ends: `primary-300/80`,
 * `own-sky-300`, `[#1f6feb]`.
 */
export function formatColorRef(ref: ColorRef): string {
  const base =
    "hex" in ref.base
      ? `[${ref.base.hex}]`
      : "own" in ref.base
        ? `${OWN_COLOR_PREFIX}${ref.base.own}`
        : ref.base.role;
  const shade = ref.shade === undefined ? "" : `-${ref.shade}`;
  const opacity = ref.opacity === undefined ? "" : `/${ref.opacity}`;
  return `${base}${shade}${opacity}`;
}

/** The theme's roles without shades: its surfaces and the colours on them. */
const UNSHADED = COLOR_ROLES.filter((role) => !(SHADED_ROLES as readonly string[]).includes(role));

/** Validates a colour ref ({@link parseColorRef}) and stores it with its hex in lower case. */
export const colorRefSchema = z
  .string()
  .max(64)
  .transform((ref, context) => {
    const parsed = parseColorRef(ref);
    if (parsed === undefined) {
      context.addIssue({
        code: "custom",
        message: "Not a theme colour, one of your colours or a hex colour",
      });
      return z.NEVER;
    }
    return formatColorRef(parsed);
  })
  // For AI apps, which read it as JSON Schema: its format, which a pattern can't say as plainly.
  .describe(
    `A colour: a theme role (${SHADED_ROLES.join(", ")}, with an optional shade such as ` +
      `primary-300; or ${UNSHADED.join(", ")}); ` +
      `one of the theme's own colours as ${OWN_COLOR_PREFIX}<id>, shades too (own-csky-700; the ` +
      "theme query lists them by id and name); or a hex colour of its own, [#1f6feb]. Any of " +
      `them with an optional opacity in percent: /${OPACITY_STEPS.join(", /")} (primary/80).`,
  );
