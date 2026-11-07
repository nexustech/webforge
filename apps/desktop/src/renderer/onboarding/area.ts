import { t } from "@webforge/i18n";
import { createElement } from "react";
import type { Area, WindowContext } from "../editor/areas.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { TipCard } from "./TipCard.js";
import { TourCards } from "./TourCards.js";
import { createTips } from "./tips.js";
import { createTour } from "./tour-store.js";

/**
 * The tour and the first-time tips (5.4a, OB-1…OB-6). The tour is offered the first time the
 * editor opens a site the quick start made, and Help › Take the Tour starts it at any time; its
 * first step, changing your words, moves on by itself once the person has changed the site. Each
 * tip shows the first time its place is reached: the first selection and switch to Content mode
 * here, the others where the areas say (`tips`), one at a time and never over the tour; it closes
 * once the person moves on.
 */
export const onboardingArea: Area<WindowContext> = {
  id: "onboarding",
  register: ({ api, preferences, session, commands, windowDialogs, tips: places }) => {
    const tour = createTour(preferences);
    const tips = createTips(preferences, () => tour.stage.getState() !== "closed");
    const Cards = () => createElement(TourCards, { tour, help: api.help });
    const Tip = () => createElement(TipCard, { tips, session });
    const removers = [
      commands.register({
        id: COMMAND_IDS.tour,
        label: t("command.tour"),
        menu: "help",
        run: tour.start,
      }),
      windowDialogs.register({ id: "tour", component: Cards }),
      windowDialogs.register({ id: "tip", component: Tip }),
      // A tip closes once the person moves on, so it never covers what they do next: a change, a
      // selection, or Design or Content mode.
      session.history.document.subscribe(() => {
        tips.dismiss();
        if (tour.stage.getState() === 0) tour.next();
      }),
      // The tour takes the place of a tip shown.
      tour.stage.subscribe((stage) => {
        if (stage !== "closed") tips.dismiss();
      }),
      places.onReached(tips.reached),
      session.ui.subscribe((state, previous) => {
        if (state.nodeId === previous.nodeId) return;
        tips.dismiss();
        if (state.nodeId !== null) tips.reached("selection");
      }),
      preferences.subscribe((state, previous) => {
        if (state.mode === previous.mode) return;
        tips.dismiss();
        if (state.mode === "content") tips.reached("contentMode");
      }),
    ];
    return () => {
      for (const remove of removers.toReversed()) remove();
    };
  },
};
