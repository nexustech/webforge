import { type PageId, SITE_CHECK_IGNORED_MAX, type SiteDoc } from "@webforge/model";
import { SITE_CHECK_RULES } from "@webforge/site-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import { starterSite } from "../../shared/starter-site.js";
import { createSiteCheck } from "./site-check-store.js";

/** The idle callbacks waiting to run, called by the test with the time an idle period has left. */
let idle: ((deadline: IdleDeadline) => void)[] = [];

/** Runs the next idle callback with `left` ms of the idle period left. */
function idlePeriod(left = 0): void {
  const next = idle.shift();
  next?.({ didTimeout: false, timeRemaining: () => left });
}

beforeEach(() => {
  idle = [];
  vi.useFakeTimers();
  vi.stubGlobal("requestIdleCallback", (work: (deadline: IdleDeadline) => void) => {
    idle.push(work);
    return idle.length;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** `site` with a page named after a Windows device: a *Must fix*. */
function withDeviceName(site: SiteDoc): SiteDoc {
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  const id = "page-con" as PageId;
  return {
    ...site,
    pages: { ...site.pages, [id]: { ...home, id, slug: "con", title: "Con" } },
    pageOrder: [...site.pageOrder, id],
  };
}

const failing = (check: ReturnType<typeof createSiteCheck>) =>
  check.state.getState().report.results.find((result) => result.rule === "deviceNames")?.findings
    .length;

describe("Site Check's recheck in idle time (ADR 0016)", () => {
  it("runs one rule per idle period with no time to spare, and shows the report at the end", () => {
    const document = createStore<SiteDoc>()(() => starterSite());
    const check = createSiteCheck(document, { ignored: [], saveIgnored: () => {} });
    expect(failing(check)).toBe(0);

    document.setState(withDeviceName(document.getState()), true);
    vi.advanceTimersByTime(400);
    for (let rule = 1; rule < SITE_CHECK_RULES.length; rule++) {
      idlePeriod(0);
      expect(failing(check)).toBe(0);
    }
    idlePeriod(0);

    expect(failing(check)).toBe(1);
    expect(idle).toEqual([]);
    check.dispose();
  });

  it("runs as many rules as an idle period has room for", () => {
    const document = createStore<SiteDoc>()(() => starterSite());
    const check = createSiteCheck(document, { ignored: [], saveIgnored: () => {} });

    document.setState(withDeviceName(document.getState()), true);
    vi.advanceTimersByTime(400);
    idlePeriod(50);

    expect(failing(check)).toBe(1);
    expect(idle).toEqual([]);
    check.dispose();
  });

  it("stops a recheck the site changed under, and starts again once it is still", () => {
    const document = createStore<SiteDoc>()(() => starterSite());
    const check = createSiteCheck(document, { ignored: [], saveIgnored: () => {} });
    const site = document.getState();

    document.setState(withDeviceName(site), true);
    vi.advanceTimersByTime(400);
    idlePeriod(0);
    // Changed back before the recheck ends: what it found so far is never shown.
    document.setState(site, true);
    while (idle.length > 0) idlePeriod(50);
    expect(failing(check)).toBe(0);

    vi.advanceTimersByTime(400);
    idlePeriod(50);
    expect(failing(check)).toBe(0);
    check.dispose();
  });

  it("runs nothing once disposed", () => {
    const document = createStore<SiteDoc>()(() => starterSite());
    const check = createSiteCheck(document, { ignored: [], saveIgnored: () => {} });
    document.setState(withDeviceName(document.getState()), true);
    vi.advanceTimersByTime(400);

    check.dispose();
    idlePeriod(50);

    expect(failing(check)).toBe(0);
  });
});

describe("what Site Check remembers as ignored (3.17)", () => {
  it("keeps one-time tips marked Done, however many other things are ignored", () => {
    const document = createStore<SiteDoc>()(() => starterSite());
    const others = Array.from({ length: SITE_CHECK_IGNORED_MAX }, (_, n) => `placeholders:${n}`);
    const saveIgnored = vi.fn();
    const check = createSiteCheck(document, {
      ignored: ["searchConsole:searchConsole", ...others],
      saveIgnored,
    });

    check.ignore("altText", "new");
    const saved: string[] = saveIgnored.mock.calls.at(-1)?.[0] ?? [];
    expect(saved).toHaveLength(SITE_CHECK_IGNORED_MAX);
    expect(saved[0]).toBe("searchConsole:searchConsole");
    expect(saved.at(-1)).toBe("altText:new");

    check.restoreIgnored();
    expect(saveIgnored).toHaveBeenLastCalledWith(["searchConsole:searchConsole"]);
  });
});

describe("Site Check and the site's allowed addresses (#649)", () => {
  /** The starter site loading a script from another website, which Settings allow. */
  const withAllowedScript = (): SiteDoc => {
    const site = starterSite();
    return {
      ...site,
      code: { ...site.code, bodyEnd: '<script src="https://cdn.example.com/w.js"></script>' },
      settings: { ...site.settings, allowedExternalUrls: ["https://cdn.example.com/"] },
    };
  };
  const external = (check: ReturnType<typeof createSiteCheck>) =>
    check.state.getState().report.results.find((result) => result.rule === "externalResources")
      ?.findings.length;

  it("applies them only once confirmed, and checks again when they are", () => {
    const document = createStore<SiteDoc>()(() => withAllowedScript());
    const allowListConfirmed = createStore<boolean>()(() => false);
    const check = createSiteCheck(document, {
      ignored: [],
      saveIgnored: () => {},
      allowListConfirmed,
    });
    expect(external(check)).toBe(1);

    allowListConfirmed.setState(true, true);
    vi.advanceTimersByTime(400);
    while (idle.length > 0) idlePeriod(100);

    expect(external(check)).toBe(0);
    check.dispose();
  });

  it("never applies them when nothing says they're confirmed", () => {
    const document = createStore<SiteDoc>()(() => withAllowedScript());
    const check = createSiteCheck(document, { ignored: [], saveIgnored: () => {} });

    expect(external(check)).toBe(1);
    check.dispose();
  });
});
