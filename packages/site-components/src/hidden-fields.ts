import {
  imageValueSchema,
  isResponsiveValue,
  type Responsive,
  resolveResponsive,
} from "@webforge/model";

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
};

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
