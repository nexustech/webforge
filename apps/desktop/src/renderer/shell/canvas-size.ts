import type { Viewport } from "@webforge/engine";
import { DESKTOP_FROM } from "@webforge/model";
import { type CustomDevice, DEVICE_SIZE } from "../../shared/ipc/prefs.js";

/**
 * The canvas's devices and widths (F-ED-8, F-ED-25): Desktop, Tablet and Mobile, the person's own
 * devices, rotating one, and the width dragging the canvas's edge snaps to. All view state: never
 * an undo step (U6).
 */

/** A built-in device view. */
export type DeviceView = "desktop" | "tablet" | "mobile";

/** A view with a fixed width. */
type FixedView = Exclude<DeviceView, "desktop">;

/**
 * Tablet's and Mobile's canvas widths, as the canvas engine shows them. Desktop has none: it fills
 * the canvas, as a site fills a browser (PH2-18), at least {@link DESKTOP_FROM} wide.
 */
export const DEVICE_WIDTHS: Readonly<Record<FixedView, number>> = { tablet: 768, mobile: 375 };

/** A device's size, built in or the person's own. */
type DeviceSize = { readonly width: number; readonly height: number };

/** Tablet's and Mobile's heights, which Rotate swaps with their widths. */
const DEVICE_HEIGHTS: Readonly<Record<FixedView, number>> = { tablet: 1024, mobile: 812 };

/** The fixed desktop widths the size menu offers, to check particular screens (PH2-18). */
export const DESKTOP_SIZES: readonly DeviceSize[] = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

/** Every device the canvas offers: the fixed desktops, Tablet and Mobile, then the person's own. */
function devicesWith(custom: readonly CustomDevice[]): DeviceSize[] {
  const views = (Object.keys(DEVICE_WIDTHS) as FixedView[]).map((view) => ({
    width: DEVICE_WIDTHS[view],
    height: DEVICE_HEIGHTS[view],
  }));
  return [...DESKTOP_SIZES, ...views, ...custom];
}

/**
 * A viewport's width in CSS pixels; Desktop's is the canvas's, `desktop` (the size the canvas
 * reports), at least {@link DESKTOP_FROM}.
 */
export const widthOf = (viewport: Viewport, desktop: number | undefined): number =>
  typeof viewport === "number"
    ? viewport
    : viewport === "desktop"
      ? Math.max(DESKTOP_FROM, desktop ?? DESKTOP_FROM)
      : DEVICE_WIDTHS[viewport];

/**
 * A width as a viewport: Tablet or Mobile at their widths, a fixed width otherwise. Never Desktop,
 * which is whatever width the canvas has.
 */
export function viewportFor(width: number): Viewport {
  const view = (Object.keys(DEVICE_WIDTHS) as FixedView[]).find(
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

/** The device a canvas `width` wide is, by name: Tablet, Mobile, or one of the person's own. */
export function deviceAt(
  width: number,
  custom: readonly CustomDevice[],
): { readonly view: FixedView } | { readonly name: string } | undefined {
  const view = (Object.keys(DEVICE_WIDTHS) as FixedView[]).find(
    (id) => DEVICE_WIDTHS[id] === width,
  );
  if (view !== undefined) return { view };
  const own = custom.find((device) => device.width === width);
  return own === undefined ? undefined : { name: own.name };
}
