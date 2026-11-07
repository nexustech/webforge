import type { PrefsApi } from "../../shared/ipc/prefs.js";
import { reportFailure } from "../log.js";

/**
 * Asks for the tour to be offered (OB-1): the quick start calls it once it has made and opened a
 * site, before the window starts over with it, so the editor that opens offers the tour. Only the
 * first time: once offered, the tour is never offered again by itself. A failure is logged, and
 * the site opens all the same.
 */
export async function offerTour(prefs: Pick<PrefsApi, "get" | "set">): Promise<void> {
  try {
    const { onboarding } = await prefs.get();
    if (onboarding.tour !== "new") return;
    await prefs.set({ onboarding: { ...onboarding, tour: "offer" } });
  } catch (error) {
    reportFailure("onboarding.offer", error);
  }
}
