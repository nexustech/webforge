import type { ReadonlyStore } from "@webforge/history";
import { SITE_CHECK_IGNORED_MAX, type SiteDoc } from "@webforge/model";
import { type CheckReport, checkSite, ignoreKey } from "@webforge/site-check";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { createStore } from "zustand/vanilla";

/** How long the site has to stay unchanged before it's checked again: typing doesn't recheck it. */
const RECHECK_DELAY_MS = 400;

/** What Site Check shows: the latest check, and what the person ignored. */
type SiteCheckState = {
  readonly report: CheckReport;
  /** {@link ignoreKey}s of the findings the person ignored. */
  readonly ignored: ReadonlySet<string>;
};

/** Site Check for one window (F-CHK-1): checks the open site as it changes. */
export type SiteCheck = {
  readonly state: ReadonlyStore<SiteCheckState>;
  /** Ignores one finding of `rule`, for this site; remembered with it. */
  ignore(rule: string, key: string): void;
  /** Brings back everything ignored. */
  restoreIgnored(): void;
  /** Stops checking. */
  dispose(): void;
};

/** What Site Check reads and where it remembers what is ignored. */
type SiteCheckOptions = {
  /** What the person ignored for the open site, as main loaded it. */
  readonly ignored: readonly string[];
  /** Remembers what is ignored with the open site. */
  readonly saveIgnored: (ignored: readonly string[]) => void;
};

/**
 * Checks `document`'s site for an export in the background (F-CHK-1): at once, then again once it
 * has stayed unchanged for {@link RECHECK_DELAY_MS}, so typing doesn't run every rule on every
 * keystroke. Ignoring a finding updates the report at once.
 */
export function createSiteCheck(
  document: ReadonlyStore<SiteDoc>,
  { ignored: initial, saveIgnored }: SiteCheckOptions,
): SiteCheck {
  const check = (site: SiteDoc, ignored: ReadonlySet<string>) =>
    checkSite({ site, catalogue: CATALOGUE }, "export", ignored);
  const firstIgnored = new Set(initial);
  const state = createStore<SiteCheckState>()(() => ({
    report: check(document.getState(), firstIgnored),
    ignored: firstIgnored,
  }));
  const recheck = (ignored = state.getState().ignored) =>
    state.setState({ report: check(document.getState(), ignored), ignored });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = document.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => recheck(), RECHECK_DELAY_MS);
  });
  const changeIgnored = (ignored: ReadonlySet<string>) => {
    recheck(ignored);
    // The latest ignored, as many as a site remembers.
    saveIgnored([...ignored].slice(-SITE_CHECK_IGNORED_MAX));
  };

  return {
    state,
    ignore(rule, key) {
      const ignored = state.getState().ignored;
      const added = ignoreKey(rule, key);
      if (!ignored.has(added)) changeIgnored(new Set([...ignored, added]));
    },
    restoreIgnored() {
      if (state.getState().ignored.size > 0) changeIgnored(new Set());
    },
    dispose() {
      clearTimeout(timer);
      stop();
    },
  };
}
