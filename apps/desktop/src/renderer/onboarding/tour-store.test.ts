import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, type OnboardingPreferences } from "../../shared/ipc/prefs.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { TOUR_STEPS } from "./tour-steps.js";
import { createTour } from "./tour-store.js";

// The tour's state (OB-1…OB-3, #991): where it is, how it moves, and what it remembers.

/** The tour on preferences whose tour is `tour`, and those preferences. */
function tourWith(tour: OnboardingPreferences["tour"]) {
  const preferences = createPreferencesStore({
    preferences: {
      ...DEFAULT_PREFERENCES,
      onboarding: { ...DEFAULT_PREFERENCES.onboarding, tour },
    },
  });
  const remembered = () => preferences.getState().preferences.onboarding.tour;
  return { tour: createTour(preferences), remembered };
}

describe("the tour (OB-1…OB-3)", () => {
  it("offers itself when asked to, and the offer lapses as skipped if it isn't answered", () => {
    const { tour, remembered } = tourWith("offer");

    expect(tour.stage.getState()).toBe("offer");
    expect(remembered()).toBe("skipped");
  });

  it("stays closed otherwise, and remembers nothing", () => {
    for (const before of ["new", "skipped", "done"] as const) {
      const { tour, remembered } = tourWith(before);
      expect(tour.stage.getState(), before).toBe("closed");
      expect(remembered(), before).toBe(before);
    }
  });

  it("goes through its steps, back no further than the first, and closes after the last", () => {
    const { tour, remembered } = tourWith("new");

    tour.start();
    expect(tour.stage.getState()).toBe(0);
    expect(remembered()).toBe("done");
    tour.back();
    expect(tour.stage.getState()).toBe(0);
    for (let step = 1; step < TOUR_STEPS.length; step += 1) {
      tour.next();
      expect(tour.stage.getState()).toBe(step);
    }
    tour.back();
    expect(tour.stage.getState()).toBe(TOUR_STEPS.length - 2);
    tour.next();
    tour.next();
    expect(tour.stage.getState()).toBe("closed");
  });

  it("moves only while a step is showing", () => {
    const { tour } = tourWith("offer");

    tour.next();
    tour.back();

    expect(tour.stage.getState()).toBe("offer");
  });

  it("skips as skipped, but a tour taken stays done, and skipping it closed changes nothing", () => {
    const offered = tourWith("offer");
    offered.tour.skip();
    expect(offered.tour.stage.getState()).toBe("closed");
    expect(offered.remembered()).toBe("skipped");

    const taken = tourWith("new");
    taken.tour.start();
    taken.tour.skip();
    expect(taken.remembered()).toBe("done");

    const closed = tourWith("new");
    closed.tour.skip();
    expect(closed.remembered()).toBe("new");
  });
});
