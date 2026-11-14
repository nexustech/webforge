import {
  imageValueSchema,
  isResponsiveValue,
  type Responsive,
  resolveResponsive,
} from "@webforge/model";
import { drawsPictureBehind, type PictureBehind } from "./picture-behind.js";

/**
 * Whether `on` holds for `value` on any device: the value itself, or one of its per-device values
 * (F-ED-4).
 */
export function onAnyDevice(value: unknown, on: (one: unknown) => boolean): boolean {
  if (!isResponsiveValue(value as Responsive<unknown>)) return on(value);
  return (["mobile", "tablet", "desktop"] as const).some((device) =>
    on(resolveResponsive(value as Responsive<unknown>, device)),
  );
}

/** What {@link hiddenFieldsOf} reads of a component: its layouts' hidden fields, and its fields. */
type Hiding = {
  readonly variantHides?: Readonly<Record<string, readonly string[]>> | undefined;
  readonly fields?: Readonly<Record<string, unknown>> | undefined;
  readonly pictureBehind?: readonly PictureBehind[] | undefined;
  readonly defaults?: Readonly<Record<string, unknown>> | undefined;
};

/**
 * The fields {@link hiddenFieldsOf} hides by other values, whatever the layout: the Appearance
 * group's Border colour (2.22b), a section's overlay (2.26), a gradient's colours (CT-10) and its
 * opacity over a picture (CT-14).
 */
const HIDDEN_BY_VALUES = [
  "lookBorderColor",
  "overlay",
  "overlayColor",
  "lookGradientFrom",
  "lookGradientTo",
  "lookGradientOpacity",
] as const;

/**
 * The fields of `component` that {@link hiddenFieldsOf} can hide, with some values or other: its
 * layouts' and {@link HIDDEN_BY_VALUES} it has. A field not among them is never hidden, so a
 * reader can leave the work of hiding out for it (#670).
 */
export function hideableFieldsOf(component: Hiding): Set<string> {
  const names = new Set(Object.values(component.variantHides ?? {}).flat());
  const fields = component.fields ?? {};
  for (const name of HIDDEN_BY_VALUES) {
    if (Object.hasOwn(fields, name)) names.add(name);
  }
  return names;
}

/**
 * The fields `component`'s chosen layout doesn't use (#311), or that its values leave unused, from
 * its `values` (with its defaults): the Edit panel hides them, the export leaves their pictures
 * and files out, and Site Check doesn't read them (#670). React-free, so Site Check and the
 * catalogue as data read it as the library does.
 */
export function hiddenFieldsOf(
  component: Hiding,
  values: Readonly<Record<string, unknown>>,
): Set<string> {
  const variant = values.variant;
  const hidden = new Set(
    typeof variant === "string" ? (component.variantHides?.[variant] ?? []) : [],
  );
  const fields = component.fields ?? {};
  // The Appearance group's Border colour, only while it draws a border on some device (2.22b).
  if (
    Object.hasOwn(fields, "lookBorderColor") &&
    !onAnyDevice(values.lookBorder, (one) => one === "thin" || one === "thick")
  ) {
    hidden.add("lookBorderColor");
  }
  // A gradient's colours, only while it has a direction on some device (CT-10): *None* keeps them
  // for when one is chosen again.
  const gradient = onAnyDevice(
    values.lookGradientDirection,
    (one) => typeof one === "string" && one !== "default",
  );
  if (Object.hasOwn(fields, "lookGradientFrom") && !gradient) {
    hidden.add("lookGradientFrom");
    hidden.add("lookGradientTo");
  }
  // Its opacity, only over a picture behind the content, where it sets how much shows (CT-14).
  if (
    Object.hasOwn(fields, "lookGradientOpacity") &&
    !(gradient && drawsPictureBehind(component, values))
  ) {
    hidden.add("lookGradientOpacity");
  }
  // A section's overlay, only once it has a background image to lie over (2.26).
  if (
    Object.hasOwn(fields, "overlay") &&
    !imageValueSchema.safeParse(values.backgroundImage).success
  ) {
    hidden.add("overlay");
    hidden.add("overlayColor");
  }
  return hidden;
}
