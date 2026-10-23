import { z } from "zod";

/** The device views a value can differ in. Desktop is the base; Tablet and Mobile override it. */
export type Breakpoint = "desktop" | "tablet" | "mobile";

/**
 * Where Tablet and Desktop start, in CSS pixels: Tailwind's `md` and `lg`, which the site's classes
 * use, so a page shows each device's values from these widths up.
 */
const TABLET_FROM = 768;
const DESKTOP_FROM = 1024;

/** The device whose values a page shows when it is `width` CSS pixels wide. */
export function breakpointForWidth(width: number): Breakpoint {
  return width >= DESKTOP_FROM ? "desktop" : width >= TABLET_FROM ? "tablet" : "mobile";
}

/** A value set per device view: `desktop` always, `tablet` and `mobile` only where they differ. */
export type ResponsiveValue<T> = {
  $responsive: { desktop: T; tablet?: T | undefined; mobile?: T | undefined };
};

/**
 * A field value that is either the same on every device or set per device view (F-ED-4). Fields
 * start as plain values; the first Tablet or Mobile override turns one into a
 * {@link ResponsiveValue}.
 */
export type Responsive<T> = T | ResponsiveValue<T>;

/** Whether `value` is set per device view. */
export function isResponsiveValue<T>(value: Responsive<T>): value is ResponsiveValue<T> {
  return typeof value === "object" && value !== null && "$responsive" in value;
}

/**
 * The value that applies in a device view. Mobile falls back to Tablet, then to Desktop, the way
 * CSS media queries cascade in a desktop-first site.
 */
export function resolveResponsive<T>(value: Responsive<T>, breakpoint: Breakpoint): T {
  if (!isResponsiveValue(value)) {
    return value;
  }
  const { desktop, tablet, mobile } = value.$responsive;
  if (breakpoint === "mobile") {
    return mobile ?? tablet ?? desktop;
  }
  if (breakpoint === "tablet") {
    return tablet ?? desktop;
  }
  return desktop;
}

/** Validates a {@link Responsive} value whose plain form `inner` validates. */
export function responsiveSchema<T>(inner: z.ZodType<T>): z.ZodType<Responsive<T>> {
  return z.union([
    z.strictObject({
      $responsive: z.strictObject({
        desktop: inner,
        tablet: inner.optional(),
        mobile: inner.optional(),
      }),
    }),
    inner,
  ]) as z.ZodType<Responsive<T>>;
}
