import { t } from "@webforge/i18n";
import { createElement } from "react";
import type { Area, WindowContext } from "../editor/areas.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { TourCards } from "./TourCards.js";
import { createTour } from "./tour-store.js";

/**
 * The tour (5.4a, OB-1…OB-3): offered the first time the editor opens a site the quick start made,
 * and Help › Take the Tour at any time. Its first step, changing your words, moves on by itself
 * once the person has changed the site.
 */
export const onboardingArea: Area<WindowContext> = {
  id: "onboarding",
  register: ({ api, preferences, session, commands, windowDialogs }) => {
    const tour = createTour(preferences);
    const Cards = () => createElement(TourCards, { tour, help: api.help });
    const removers = [
      commands.register({
        id: COMMAND_IDS.tour,
        label: t("command.tour"),
        menu: "help",
        run: tour.start,
      }),
      windowDialogs.register({ id: "tour", component: Cards }),
      session.history.document.subscribe(() => {
        if (tour.stage.getState() === 0) tour.next();
      }),
    ];
    return () => {
      for (const remove of removers.toReversed()) remove();
    };
  },
};
