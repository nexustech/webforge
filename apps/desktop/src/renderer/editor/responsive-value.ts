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

/** The devices, Desktop first, as the Edit panel lists a field's values per device (SP-5). */
export const DEVICES: readonly Breakpoint[] = ["desktop", "tablet", "mobile"];

/**
 * The device whose value applies on `breakpoint`: its own if it has one, else the one the page
 * falls back to. Resolved by the page's own rule ({@link resolveResponsive}) over the devices' names
 * rather than their values, so it can't differ from what the canvas draws (#425 review).
 */
export function sourceOf(value: unknown, breakpoint: Breakpoint): Breakpoint {
  const own = (device: Breakpoint) => (isOverridden(value, device) ? device : undefined);
  return resolveResponsive<Breakpoint>(
    { $responsive: { desktop: "desktop", tablet: own("tablet"), mobile: own("mobile") } },
    breakpoint,
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

/** Whether two field values are the same: equal as JSON, which they are (props are JSON). */
const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Whether a field's value `stored` is changed from the component's default `initial` for the
 * device shown (UX-18), so resetting it would change something: on Desktop (or for a field that is
 * the same on every device) its value differs; on Tablet or Mobile it has a value of its own, which
 * a reset drops.
 */
export function differsFromDefault(
  stored: unknown,
  initial: unknown,
  responsive: boolean,
  breakpoint: Breakpoint,
): boolean {
  if (!responsive) return !sameValue(stored, initial);
  if (breakpoint !== "desktop") return isOverridden(stored, breakpoint);
  return !sameValue(valueAt(stored, "desktop"), valueAt(initial, "desktop"));
}
