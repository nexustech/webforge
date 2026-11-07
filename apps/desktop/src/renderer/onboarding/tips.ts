import type { ScreenBox } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { TipId } from "../editor/first-tips.js";
import type { PreferencesStore } from "../shell/preferences-store.js";
import { elementOnPage, inWindow } from "./anchors.js";

/** What a tip points at, given the selected element; centred without it. */
type TipAnchor = (document: Document, selected: string | null) => ScreenBox | null;

/** Where each tip points (OB-4): the selection, the Design | Content switch, Site Check. */
export const TIP_ANCHORS: Readonly<Partial<Record<TipId, TipAnchor>>> = {
  selection: (document, selected) => (selected === null ? null : elementOnPage(document, selected)),
  contentMode: (document) =>
    inWindow(document, `[role="group"][aria-label="${CSS.escape(t("shell.mode"))}"]`),
  mustFix: (document) =>
    inWindow(document, `[data-region][aria-label="${CSS.escape(t("panels.drawer"))}"]`),
};

/** The first-time tips as the window shows them: the one shown, if any. */
export type Tips = {
  readonly shown: StoreApi<TipId | null>;
  /**
   * The person has reached `tip`'s place: it's shown if tips are on, it hasn't been seen, and no
   * other card is showing (`busy`, the tour). Shown, it's remembered as seen; one that can't be
   * shown now waits for the next time its place is reached.
   */
  reached(tip: TipId): void;
  /** *Got it*, or Esc. */
  dismiss(): void;
};

/**
 * The first-time tips (OB-4, OB-5): one at a time, each once, kept in the person's preferences
 * (OB-6), and none while *Show tips* is off.
 */
export function createTips(preferences: PreferencesStore, busy: () => boolean): Tips {
  const shown = createStore<TipId | null>(() => null);
  return {
    shown,
    reached(tip) {
      const { onboarding } = preferences.getState().preferences;
      if (!onboarding.showTips || onboarding.tipsSeen.includes(tip)) return;
      if (shown.getState() !== null || busy()) return;
      preferences.change({
        onboarding: { ...onboarding, tipsSeen: [...onboarding.tipsSeen, tip] },
      });
      shown.setState(tip, true);
    },
    dismiss() {
      shown.setState(null, true);
    },
  };
}
