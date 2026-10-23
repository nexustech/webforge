import type { Viewport } from "@webforge/engine";
import {
  type Breakpoint,
  breakpointForWidth,
  isResponsiveValue,
  type Responsive,
  type ResponsiveValue,
  resolveResponsive,
} from "@webforge/model";

/**
 * The device whose values the Edit panel shows for a canvas view: for a custom width, the values
 * the page uses at that width.
 */
export function breakpointOf(viewport: Viewport): Breakpoint {
  return typeof viewport === "number" ? breakpointForWidth(viewport) : viewport;
}

const asResponsive = (value: unknown) => value as Responsive<unknown>;

/** The value a field has on `breakpoint`, whether it differs per device or not. */
export function valueAt(value: unknown, breakpoint: Breakpoint): unknown {
  return resolveResponsive(asResponsive(value), breakpoint);
}

/** Whether `breakpoint` has its own value, overriding Desktop's (Desktop never does). */
export function isOverridden(value: unknown, breakpoint: Breakpoint): boolean {
  return (
    breakpoint !== "desktop" &&
    isResponsiveValue(asResponsive(value)) &&
    (value as ResponsiveValue<unknown>).$responsive[breakpoint] !== undefined
  );
}

/** Drops empty overrides; a value with none left is plain again. */
function normalised(value: ResponsiveValue<unknown>): Responsive<unknown> {
  const { desktop, tablet, mobile } = value.$responsive;
  if (tablet === undefined && mobile === undefined) {
    return desktop;
  }
  return {
    $responsive: {
      desktop,
      ...(tablet === undefined ? {} : { tablet }),
      ...(mobile === undefined ? {} : { mobile }),
    },
  };
}

/**
 * `current` with `next` set for `breakpoint`: on Desktop the base value (overrides stay), on Tablet
 * or Mobile an override, turning a plain value into one that differs per device.
 */
export function withValueAt(
  current: unknown,
  breakpoint: Breakpoint,
  next: unknown,
): Responsive<unknown> {
  const responsive = isResponsiveValue(asResponsive(current))
    ? (current as ResponsiveValue<unknown>).$responsive
    : { desktop: current };
  return normalised({ $responsive: { ...responsive, [breakpoint]: next } });
}

/** `current` without `breakpoint`'s override: that device uses the Desktop value again. */
export function withoutOverride(current: unknown, breakpoint: Breakpoint): Responsive<unknown> {
  if (breakpoint === "desktop" || !isResponsiveValue(asResponsive(current))) {
    return asResponsive(current);
  }
  const { [breakpoint]: _dropped, ...rest } = (current as ResponsiveValue<unknown>).$responsive;
  return normalised({ $responsive: { ...rest, desktop: rest.desktop } });
}
