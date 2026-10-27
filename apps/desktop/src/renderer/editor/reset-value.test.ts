import { type Breakpoint, resolveResponsive } from "@webforge/model";
import { withLook } from "@webforge/site-components";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { resetValue } from "./reset-value.js";

// Resetting a field an element's kind's look sets (3.12, CT-1): the element takes the look again.

const CORNERS = ["default", "none", "small", "medium", "large", "full"] as const;
const DEVICES: readonly Breakpoint[] = ["desktop", "tablet", "mobile"];
const corner = fc.constantFrom(...CORNERS);
/** A value as an element stores it: set once, or per device. */
const stored = fc.oneof(
  corner,
  fc
    .record({ desktop: corner, tablet: corner, mobile: corner }, { requiredKeys: ["desktop"] })
    .map(($responsive) => ({ $responsive })),
);

/** What the element draws on `device`: its own value over its kind's look. */
const drawn = (own: unknown, look: unknown, device: Breakpoint) => {
  const values = withLook(own === undefined ? {} : { lookCorners: own }, "Button", {
    Button: { lookCorners: look as string },
  });
  return resolveResponsive(values.lookCorners as never, device);
};

describe("resetValue with a look (3.12, CT-1)", () => {
  it("returns an element its own value was reset on Desktop to its kind's look, on every device it didn't set apart", () => {
    fc.assert(
      fc.property(corner, stored, (look, own) => {
        const reset = resetValue(own, {
          responsive: true,
          breakpoint: "desktop",
          initial: undefined,
          look,
        });

        // Desktop's is the look's; a device that kept a value of its own keeps it, and the others
        // take the next larger device's, as everywhere (F-ED-4).
        const kept = typeof own === "object" ? own.$responsive : {};
        const expected = {
          $responsive: {
            desktop: look,
            ...(kept.tablet === undefined ? {} : { tablet: kept.tablet }),
            ...(kept.mobile === undefined ? {} : { mobile: kept.mobile }),
          },
        };
        for (const device of DEVICES) {
          expect(drawn(reset, look, device), device).toBe(resolveResponsive(expected, device));
        }
      }),
    );
  });

  it("leaves the field unset when nothing else holds it, so later changes to the look reach it", () => {
    fc.assert(
      fc.property(corner, corner, (look, own) => {
        expect(
          resetValue(own, { responsive: true, breakpoint: "desktop", initial: undefined, look }),
        ).toBeUndefined();
      }),
    );
  });

  it("resets to the component's default where the kind has no look, as before", () => {
    expect(
      resetValue("large", { responsive: true, breakpoint: "desktop", initial: "default" }),
    ).toEqual("default");
    expect(
      resetValue("large", { responsive: false, breakpoint: "desktop", initial: "default" }),
    ).toBe("default");
    // Another device's own value goes, so it takes Desktop's again.
    expect(
      resetValue(
        { $responsive: { desktop: "large", mobile: "none" } },
        { responsive: true, breakpoint: "mobile", initial: "default", look: "full" },
      ),
    ).toEqual("large");
  });
});
