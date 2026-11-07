import { createStore, type StoreApi } from "zustand/vanilla";
import type { OnboardingPreferences } from "../../shared/ipc/prefs.js";
import type { PreferencesStore } from "../shell/preferences-store.js";
import { TOUR_STEPS } from "./tour-steps.js";

/** What the tour shows: nothing, the offer (OB-1), or a step, by its place in {@link TOUR_STEPS}. */
export type TourStage = "closed" | "offer" | number;

/** The tour as the window shows it, and how it moves on. */
export type Tour = {
  readonly stage: StoreApi<TourStage>;
  /** Help › Take the Tour, or *Show me around*: from the first step. */
  start(): void;
  /** *Not now*, *Skip tour* or Esc: closes it, remembered as skipped unless it was taken. */
  skip(): void;
  next(): void;
  back(): void;
};

/**
 * The tour's state (OB-1…OB-3): offered when `preferences` say so, the quick start having asked
 * (`offerTour`), and answered in them, never in the site. Taken, it's `done`, and skipping it then
 * doesn't change that; *Not now* makes it `skipped`. Either way it's never offered again by itself.
 */
export function createTour(preferences: PreferencesStore): Tour {
  const onboarding = () => preferences.getState().preferences.onboarding;
  const remember = (tour: OnboardingPreferences["tour"]) => {
    if (onboarding().tour === tour) return;
    preferences.change({ onboarding: { ...onboarding(), tour } });
  };
  const stage = createStore<TourStage>(() => (onboarding().tour === "offer" ? "offer" : "closed"));
  const go = (next: TourStage) => stage.setState(next, true);
  const at = () => stage.getState();
  return {
    stage,
    start() {
      remember("done");
      go(0);
    },
    skip() {
      if (at() === "closed") return;
      if (onboarding().tour !== "done") remember("skipped");
      go("closed");
    },
    next() {
      const now = at();
      if (typeof now !== "number") return;
      go(now + 1 < TOUR_STEPS.length ? now + 1 : "closed");
    },
    back() {
      const now = at();
      if (typeof now === "number" && now > 0) go(now - 1);
    },
  };
}
