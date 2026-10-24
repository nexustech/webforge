import { z } from "zod";
import { isResponsiveValue, type Responsive, type ResponsiveValue } from "./responsive.js";

/** The sides of a box (1.32), in CSS order. */
export const BOX_SIDES = ["top", "right", "bottom", "left"] as const;

/** One side of a box. */
export type BoxSide = (typeof BOX_SIDES)[number];

/** The spacing tokens a side can take, smallest first (C4): users choose a size, never a value. */
export const SPACING_TOKENS = ["none", "s", "m", "l", "xl"] as const;

/** One spacing token. */
export type SpacingToken = (typeof SPACING_TOKENS)[number];

const spacingTokenSchema = z.enum(SPACING_TOKENS);

/**
 * Padding or margin per side (1.32): a token for each side set, the component's default for each
 * side left out.
 */
export const boxValueSchema = z.strictObject({
  top: spacingTokenSchema.optional(),
  right: spacingTokenSchema.optional(),
  bottom: spacingTokenSchema.optional(),
  left: spacingTokenSchema.optional(),
});

/** See {@link boxValueSchema}. */
export type BoxValue = z.infer<typeof boxValueSchema>;

/**
 * The box a stored value holds; nothing set (every side its default) for anything else. A
 * Section's padding saved before 1.32 as one size is migrated by format 6 (`MIGRATIONS[5]`).
 */
export function boxValueOf(value: unknown): BoxValue {
  const parsed = boxValueSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

/** A stored box field, per device or not, with every device's value read by {@link boxValueOf}. */
export function responsiveBoxOf(value: unknown): Responsive<BoxValue> {
  if (!isResponsiveValue(value as Responsive<unknown>)) {
    return boxValueOf(value);
  }
  const { desktop, tablet, mobile } = (value as ResponsiveValue<unknown>).$responsive;
  return {
    $responsive: {
      desktop: boxValueOf(desktop),
      ...(tablet === undefined ? {} : { tablet: boxValueOf(tablet) }),
      ...(mobile === undefined ? {} : { mobile: boxValueOf(mobile) }),
    },
  };
}
