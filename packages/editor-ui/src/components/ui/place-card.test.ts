import { describe, expect, it } from "vitest";
import { placeCard } from "./place-card.js";

const VIEW = { width: 1200, height: 800 };
const CARD = { width: 320, height: 160 };

describe("placeCard (OB-3)", () => {
  it("goes below what it points at, lined up with its middle", () => {
    expect(placeCard({ left: 400, top: 100, width: 200, height: 40 }, CARD, VIEW)).toEqual({
      side: "below",
      left: 340,
      top: 148,
    });
  });

  it("stays inside the window: a button at the top right puts it below, against the edge", () => {
    expect(placeCard({ left: 1150, top: 4, width: 40, height: 32 }, CARD, VIEW)).toEqual({
      side: "below",
      left: 1200 - 320 - 12,
      top: 44,
    });
  });

  it("goes above, then right, then left, when there's no room below", () => {
    expect(placeCard({ left: 400, top: 700, width: 200, height: 60 }, CARD, VIEW).side).toBe(
      "above",
    );
    // As tall as the window: beside it.
    expect(placeCard({ left: 100, top: 0, width: 200, height: 800 }, CARD, VIEW)).toMatchObject({
      side: "right",
      left: 308,
    });
    expect(placeCard({ left: 800, top: 0, width: 300, height: 800 }, CARD, VIEW)).toMatchObject({
      side: "left",
      left: 800 - 8 - 320,
    });
  });

  it("is centred with nothing to point at, nothing seen, or no room on any side", () => {
    const centre = { side: "centre", left: 440, top: 320 };
    expect(placeCard(null, CARD, VIEW)).toEqual(centre);
    expect(placeCard({ left: 10, top: 10, width: 0, height: 0 }, CARD, VIEW)).toEqual(centre);
    // Scrolled out of the window, or a hidden panel's.
    expect(placeCard({ left: 400, top: -200, width: 200, height: 40 }, CARD, VIEW)).toEqual(centre);
    expect(placeCard({ left: 1300, top: 100, width: 200, height: 40 }, CARD, VIEW)).toEqual(centre);
    expect(placeCard({ left: 0, top: 0, width: 1200, height: 800 }, CARD, VIEW)).toEqual(centre);
  });
});
