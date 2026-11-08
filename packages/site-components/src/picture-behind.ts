import { imageValueSchema } from "@webforge/model";

/**
 * A picture a component draws behind its content (#670): its image field, and the layouts it's
 * behind the content in, every layout when none are named. A section's background image (2.26) is
 * one; so is a Hero's image in its background layout.
 */
export type PictureBehind = {
  readonly field: string;
  readonly variants?: readonly string[] | undefined;
};

/** What {@link drawsPictureBehind} reads of a component: its pictures behind, and its defaults. */
type Behind = {
  readonly pictureBehind?: readonly PictureBehind[] | undefined;
  readonly defaults?: Readonly<Record<string, unknown>> | undefined;
};

/**
 * Whether `component`, with `values`, draws a picture behind its content: one of its pictures
 * behind has an image placed, in a layout it's behind the content in. A picture's colours can't be
 * known, so the colour field and Site Check measure no contrast on it (#670). React-free, so Site
 * Check reads it from the catalogue as data as the editor does from the library.
 */
export function drawsPictureBehind(
  component: Behind,
  values: Readonly<Record<string, unknown>>,
): boolean {
  const { pictureBehind } = component;
  if (pictureBehind === undefined) return false;
  const variant = values.variant ?? component.defaults?.variant;
  return pictureBehind.some(
    ({ field, variants }) =>
      values[field] !== undefined &&
      (variants === undefined || (typeof variant === "string" && variants.includes(variant))) &&
      imageValueSchema.safeParse(values[field]).success,
  );
}
