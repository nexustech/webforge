import { z } from "zod";
import {
  COLOR_ROLES,
  type ColorRole,
  OPACITY_STEPS,
  SHADE_STEPS,
  SHADED_ROLES,
  type ShadeStep,
} from "./theme.js";

/**
 * A colour a style field uses (2.1, 1.37): `<base>[-<shade>][/<opacity>]`, read as Tailwind reads a
 * class's colour (`bg-primary-300/80`). The base is a theme role, with shades for the colour roles
 * only, or, in Advanced mode, a colour of the field's own as a Tailwind arbitrary value
 * (`[#1f6feb]`, decision of 23 Oct 2026), which theme changes leave as it is.
 */
export type ColorRef = {
  /** A role, or a colour of the field's own as six lower-case hex digits (`#1f6feb`). */
  readonly base: { readonly role: ColorRole } | { readonly hex: string };
  readonly shade?: ShadeStep;
  /** In percent; none means opaque. */
  readonly opacity?: (typeof OPACITY_STEPS)[number];
};

const SHADES = SHADE_STEPS.join("|");
const OPACITIES = OPACITY_STEPS.join("|");
const ROLES = [...COLOR_ROLES].sort((a, b) => b.length - a.length).join("|");
const SHADED = SHADED_ROLES.join("|");
// Only six hex digits fit between the brackets, so nothing else can reach the class or the CSS.
const PATTERN = new RegExp(
  `^(?:(?<shaded>${SHADED})(?:-(?<shade>${SHADES}))?|(?<role>${ROLES})|\\[(?<hex>#[0-9a-fA-F]{6})\\])(?:/(?<opacity>${OPACITIES}))?$`,
);

/** What `ref` names, or undefined if it isn't a colour ref. A hex colour comes back lower case. */
export function parseColorRef(ref: string): ColorRef | undefined {
  const groups = PATTERN.exec(ref)?.groups;
  if (groups === undefined) return undefined;
  const base =
    groups.hex !== undefined
      ? { hex: groups.hex.toLowerCase() }
      : { role: (groups.shaded ?? groups.role) as ColorRole };
  return {
    base,
    ...(groups.shade === undefined ? {} : { shade: Number(groups.shade) as ShadeStep }),
    ...(groups.opacity === undefined
      ? {}
      : { opacity: Number(groups.opacity) as (typeof OPACITY_STEPS)[number] }),
  };
}

/** `ref` written out, as a style field stores it and a class ends: `primary-300/80`, `[#1f6feb]`. */
export function formatColorRef(ref: ColorRef): string {
  const base = "hex" in ref.base ? `[${ref.base.hex}]` : ref.base.role;
  const shade = ref.shade === undefined ? "" : `-${ref.shade}`;
  const opacity = ref.opacity === undefined ? "" : `/${ref.opacity}`;
  return `${base}${shade}${opacity}`;
}

/** Validates a colour ref ({@link parseColorRef}) and stores it with its hex in lower case. */
export const colorRefSchema = z
  .string()
  .max(64)
  .transform((ref, context) => {
    const parsed = parseColorRef(ref);
    if (parsed === undefined) {
      context.addIssue({ code: "custom", message: "Not a theme colour or a hex colour" });
      return z.NEVER;
    }
    return formatColorRef(parsed);
  });
