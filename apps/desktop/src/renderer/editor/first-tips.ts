/**
 * The first-time tips (OB-4, 5.4a), each shown the first time the person reaches its place:
 * - `selection`: the first element selected on the page;
 * - `contentMode`: the first switch to Content mode;
 * - `mustFix`: the first *Must fix* Site Check shows;
 * - `export`: the first export, once its report has closed;
 * - `themeStudio`: the first Theme Studio, once it has closed.
 */
const TIP_IDS = ["selection", "contentMode", "mustFix", "export", "themeStudio"] as const;

/** A first-time tip, by id. */
export type TipId = (typeof TIP_IDS)[number];

/**
 * Where the areas say the person has reached a tip's place (Site Check, Export, Theme Studio), and
 * the onboarding area hears it: it shows the tip if it's the first time, tips are on and no other
 * card is showing.
 */
export type FirstTips = {
  /** Says the person has reached `tip`'s place. */
  reached(tip: TipId): void;
  /** Calls `listener` each time a tip's place is reached; returns a function that stops. */
  onReached(listener: (tip: TipId) => void): () => void;
};

/**
 * Calls `then` each time what `isOpen` reads closes, as `subscribe` says it may have changed: a
 * tip that follows a dialog shows once the dialog has closed, since a dialog keeps clicks to
 * itself. Returns a function that stops.
 */
export function whenClosed(
  subscribe: (listener: () => void) => () => void,
  isOpen: () => boolean,
  then: () => void,
): () => void {
  let open = isOpen();
  return subscribe(() => {
    const now = isOpen();
    if (open && !now) then();
    open = now;
  });
}

/** A {@link FirstTips}, one per window. */
export function createFirstTips(): FirstTips {
  const listeners = new Set<(tip: TipId) => void>();
  return {
    reached(tip) {
      for (const listener of listeners) listener(tip);
    },
    onReached(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
