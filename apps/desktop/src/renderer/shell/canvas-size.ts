import type { Viewport } from "@webforge/engine";
import { type CustomDevice, DEVICE_SIZE } from "../../shared/ipc/prefs.js";

/**
 * The canvas's devices and widths (F-ED-8, F-ED-25): Desktop, Tablet and Mobile, the person's own
 * devices, rotating one, and the width dragging the canvas's edge snaps to. All view state: never
 * an undo step (U6).
 */

/** The built-in device views' canvas widths, as the canvas engine shows them. */
export const DEVICE_WIDTHS = { desktop: 1280, tablet: 768, mobile: 375 } as const;

/** A built-in device view. */
export type DeviceView = keyof typeof DEVICE_WIDTHS;

/** The built-in devices' heights, which Rotate swaps with their widths. */
const DEVICE_HEIGHTS: Record<DeviceView, number> = { desktop: 800, tablet: 1024, mobile: 812 };

/** A device's size, built in or the person's own. */
type DeviceSize = { readonly width: number; readonly height: number };

/** Every device the canvas offers: the built-in ones, then the person's own. */
function devicesWith(custom: readonly CustomDevice[]): DeviceSize[] {
  const builtIn = (Object.keys(DEVICE_WIDTHS) as DeviceView[]).map((view) => ({
    width: DEVICE_WIDTHS[view],
    height: DEVICE_HEIGHTS[view],
  }));
  return [...builtIn, ...custom];
}

/** A viewport's width in CSS pixels. */
export const widthOf = (viewport: Viewport): number =>
  typeof viewport === "number" ? viewport : DEVICE_WIDTHS[viewport];

/** A width as a viewport: a device view when it is one's width, a custom width otherwise. */
export function viewportFor(width: number): Viewport {
  const view = (Object.keys(DEVICE_WIDTHS) as DeviceView[]).find(
    (id) => DEVICE_WIDTHS[id] === width,
  );
  return view ?? width;
}

/** `width` kept within what the canvas shows. */
export const clampWidth = (width: number): number =>
  Math.min(DEVICE_SIZE.max, Math.max(DEVICE_SIZE.min, Math.round(width)));

/**
 * The width Rotate gives a canvas `width` wide: a device's height when it is that device's width,
 * its width when it is its height (rotated back). `undefined` when no device has that size.
 */
export function rotatedWidth(width: number, custom: readonly CustomDevice[]): number | undefined {
  const devices = devicesWith(custom);
  const upright = devices.find((device) => device.width === width);
  if (upright !== undefined) return clampWidth(upright.height);
  const turned = devices.find((device) => device.height === width);
  return turned === undefined ? undefined : clampWidth(turned.width);
}

/** How close a dragged edge must come to a device's width to snap to it, in screen pixels. */
const SNAP_DISTANCE = 12;

/**
 * A width dragged to `width`, snapped to the nearest device width whose edge is within
 * {@link SNAP_DISTANCE} screen pixels at `zoom`. The canvas is centred, so each edge sits half the
 * width from the middle.
 */
export function snappedWidth(width: number, custom: readonly CustomDevice[], zoom: number): number {
  const reach = (SNAP_DISTANCE * 2) / zoom;
  let best: number | undefined;
  for (const { width: device } of devicesWith(custom)) {
    const distance = Math.abs(device - width);
    if (distance <= reach && (best === undefined || distance < Math.abs(best - width))) {
      best = device;
    }
  }
  return clampWidth(best ?? width);
}

/** The device a canvas `width` wide is, by name: a built-in view's, or one of the person's own. */
export function deviceAt(
  width: number,
  custom: readonly CustomDevice[],
): { readonly view: DeviceView } | { readonly name: string } | undefined {
  const view = viewportFor(width);
  if (typeof view === "string") return { view };
  const own = custom.find((device) => device.width === width);
  return own === undefined ? undefined : { name: own.name };
}
