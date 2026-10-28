import { type Breakpoint, isResponsiveValue, type Responsive } from "@webforge/model";
import { valueAt, withoutOverride, withValueAt } from "./responsive-value.js";

/**
 * What a field's stored value becomes when its *Reset* is chosen on `breakpoint` (UX-13): a value
 * set once goes back to `initial`, the component's default; per device, Desktop's does, or
 * another device's own value goes, so it takes Desktop's again (F-ED-4).
 *
 * A field its kind's look sets (`look`, 3.12, CT-1) is left unset instead, so the element takes the
 * look again, and any later change to it: on Desktop, unless another device keeps a value of its
 * own, which then stays while Desktop's becomes the look's.
 */
export function resetValue(
  stored: unknown,
  options: {
    readonly responsive: boolean;
    readonly breakpoint: Breakpoint;
    readonly initial: unknown;
    /** The look's value for the field, if its kind's look sets one. */
    readonly look?: unknown;
  },
): unknown {
  const { responsive, breakpoint, initial, look } = options;
  if (responsive && breakpoint !== "desktop") return withoutOverride(stored, breakpoint);
  if (look !== undefined && !hasOtherDevices(stored)) return undefined;
  const reset = look ?? initial;
  return responsive ? withValueAt(stored, "desktop", valueAt(reset, "desktop")) : reset;
}

/** Whether `stored` has a value of its own for Tablet or Mobile. */
function hasOtherDevices(stored: unknown): boolean {
  if (!isResponsiveValue(stored as Responsive<unknown>)) return false;
  const { tablet, mobile } = (stored as { $responsive: Record<string, unknown> }).$responsive;
  return tablet !== undefined || mobile !== undefined;
}
