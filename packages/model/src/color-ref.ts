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
 * class's colour (`bg-primary-300/80`). The base is a theme role or a custom colour
 * (`custom-<id>`); shades are for the colour roles and custom colours only.
 */
export type ColorRef = {
  /** A role, or a custom colour's id. */
  readonly base: { readonly role: ColorRole } | { readonly custom: string };
  readonly shade?: ShadeStep;
  /** In percent; none means opaque. */
  readonly opacity?: (typeof OPACITY_STEPS)[number];
};

const SHADES = SHADE_STEPS.join("|");
const OPACITIES = OPACITY_STEPS.join("|");
const ROLES = [...COLOR_ROLES].sort((a, b) => b.length - a.length).join("|");
const SHADED = SHADED_ROLES.join("|");
const PATTERN = new RegExp(
  `^(?:(?<shaded>${SHADED})(?:-(?<roleShade>${SHADES}))?|(?<role>${ROLES})|custom-(?<custom>[a-z0-9]+(?:-[a-z0-9]+)*?)(?:-(?<customShade>${SHADES}))?)(?:/(?<opacity>${OPACITIES}))?$`,
);

/** What `ref` names, or undefined if it isn't a colour ref. */
export function parseColorRef(ref: string): ColorRef | undefined {
  const groups = PATTERN.exec(ref)?.groups;
  if (groups === undefined) return undefined;
  const shade = groups.roleShade ?? groups.customShade;
  const base =
    groups.custom !== undefined
      ? { custom: groups.custom }
      : { role: (groups.shaded ?? groups.role) as ColorRole };
  return {
    base,
    ...(shade === undefined ? {} : { shade: Number(shade) as ShadeStep }),
    ...(groups.opacity === undefined
      ? {}
      : { opacity: Number(groups.opacity) as (typeof OPACITY_STEPS)[number] }),
  };
}

/** Validates a colour ref ({@link parseColorRef}). */
export const colorRefSchema = z
  .string()
  .max(64)
  .refine((ref) => parseColorRef(ref) !== undefined, {
    message: "Not a theme colour",
  });
