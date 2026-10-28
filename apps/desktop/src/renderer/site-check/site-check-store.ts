import type { ReadonlyStore } from "@webforge/history";
import { SITE_CHECK_IGNORED_MAX, type SiteDoc } from "@webforge/model";
import {
  type CheckReport,
  type CheckRule,
  type Finding,
  ignoreKey,
  reportOf,
  SITE_CHECK_RULES,
} from "@webforge/site-check";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { createStore } from "zustand/vanilla";

/** How long the site has to stay unchanged before it's checked again: typing doesn't recheck it. */
const RECHECK_DELAY_MS = 400;

/**
 * Time left in an idle period below which a recheck yields until the next one rather than start
 * another rule. Each rule takes a few milliseconds on a large site (ADR 0016).
 */
const IDLE_MARGIN_MS = 4;

/** The longest a recheck's next rule waits for an idle period, so a busy window still updates. */
const IDLE_TIMEOUT_MS = 1000;

/** Calls `work` once the renderer is idle; on the next turn where it has no idle callbacks. */
function whenIdle(work: (deadline?: IdleDeadline) => void): void {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(work, { timeout: IDLE_TIMEOUT_MS });
  } else {
    setTimeout(work, 0);
  }
}

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
  /** Brings back everything ignored, but not the one-time tips marked *Done* (3.17). */
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
 * keystroke. A recheck runs its rules in the renderer's idle time, as many as an idle period has
 * room for, so no rule runs while the person types or a frame is due (ADR 0016); a change while it
 * runs starts it again. Ignoring a finding updates the report at once, without running the rules.
 */
export function createSiteCheck(
  document: ReadonlyStore<SiteDoc>,
  { ignored: initial, saveIgnored }: SiteCheckOptions,
): SiteCheck {
  const runAll = (site: SiteDoc) =>
    new Map(SITE_CHECK_RULES.map((rule) => [rule, rule.check({ site, catalogue: CATALOGUE })]));
  /** What each rule found in the latest check, before anything ignored is left out. */
  let found: ReadonlyMap<CheckRule, readonly Finding[]> = runAll(document.getState());
  const report = (ignored: ReadonlySet<string>) =>
    reportOf((rule) => found.get(rule) ?? [], "export", ignored);
  const firstIgnored = new Set(initial);
  /** What *Done* marked: one-time tips' findings (3.17), which stay done. */
  const isDone = (key: string) =>
    SITE_CHECK_RULES.some(
      (rule) => rule.oneTime === true && key.startsWith(ignoreKey(rule.id, "")),
    );
  const state = createStore<SiteCheckState>()(() => ({
    report: report(firstIgnored),
    ignored: firstIgnored,
  }));
  const show = (ignored = state.getState().ignored) =>
    state.setState({ report: report(ignored), ignored });

  /** Counts rechecks: one that a change or `dispose` has overtaken stops. */
  let pass = 0;
  const recheck = () => {
    const mine = ++pass;
    const site = document.getState();
    const next = new Map<CheckRule, readonly Finding[]>();
    const rules = [...SITE_CHECK_RULES];
    const step = (deadline?: IdleDeadline) => {
      if (mine !== pass) return;
      // At least one rule each time, so a window never idle still gets there.
      do {
        const rule = rules.shift();
        if (rule === undefined) break;
        next.set(rule, rule.check({ site, catalogue: CATALOGUE }));
      } while (rules.length > 0 && (deadline?.timeRemaining() ?? 0) > IDLE_MARGIN_MS);
      if (rules.length > 0) {
        whenIdle(step);
      } else {
        found = next;
        show();
      }
    };
    whenIdle(step);
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = document.subscribe(() => {
    pass++;
    clearTimeout(timer);
    timer = setTimeout(recheck, RECHECK_DELAY_MS);
  });
  const changeIgnored = (ignored: ReadonlySet<string>) => {
    show(ignored);
    // The latest ignored, as many as a site remembers; one-time tips marked *Done* first, so they
    // never come back.
    const done = [...ignored].filter(isDone);
    const others = [...ignored].filter((key) => !isDone(key));
    saveIgnored([...done, ...others.slice(-(SITE_CHECK_IGNORED_MAX - done.length))]);
  };

  return {
    state,
    ignore(rule, key) {
      const ignored = state.getState().ignored;
      const added = ignoreKey(rule, key);
      if (!ignored.has(added)) changeIgnored(new Set([...ignored, added]));
    },
    restoreIgnored() {
      const { ignored } = state.getState();
      const kept = [...ignored].filter(isDone);
      if (kept.length < ignored.size) changeIgnored(new Set(kept));
    },
    dispose() {
      pass++;
      clearTimeout(timer);
      stop();
    },
  };
}
