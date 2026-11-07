// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES, type OnboardingPreferences } from "../../shared/ipc/prefs.js";
import { WINDOW_AREAS } from "../areas.js";
import type { WindowContext } from "../editor/areas.js";
import { createFirstTips } from "../editor/first-tips.js";
import { bundledHelpLibrary } from "../help/index.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { createWindowDialogs, WindowDialogs } from "../shell/window-dialogs.js";
import { registriesForTest, sessionWith } from "../testing/fixtures.js";
import { fakePreloadApi } from "../testing/preload.js";
import { onboardingArea } from "./area.js";
import { offerTour } from "./offer.js";
import { TOUR_STEPS } from "./tour-steps.js";

afterEach(cleanup);

/** The window with the onboarding area registered, the tour as `tour` left it. */
function setUp(
  tour: OnboardingPreferences["tour"] = "new",
  onboarding: Partial<OnboardingPreferences> = {},
) {
  const registries = registriesForTest();
  const saved = vi.fn(async () => undefined);
  const preferences = createPreferencesStore(
    {
      preferences: {
        ...DEFAULT_PREFERENCES,
        onboarding: { ...DEFAULT_PREFERENCES.onboarding, tour, ...onboarding },
      },
    },
    { preferences: saved },
  );
  const session = sessionWith();
  const windowDialogs = createWindowDialogs();
  const open = vi.fn(async () => true);
  const places = createFirstTips();
  const remove = onboardingArea.register({
    ...registries,
    preferences,
    session,
    windowDialogs,
    tips: places,
    api: fakePreloadApi({ help: { open } }),
  } as unknown as WindowContext);
  render(<WindowDialogs registry={windowDialogs} />);
  const tourState = () => preferences.getState().preferences.onboarding.tour;
  const seen = () => preferences.getState().preferences.onboarding.tipsSeen;
  return {
    commands: registries.commands,
    session,
    open,
    remove,
    tourState,
    saved,
    places,
    preferences,
    seen,
  };
}

const card = () => screen.getByRole("region");

describe("the tour (5.4a, OB-1…OB-3)", () => {
  it("is listed in the composition root", () => {
    expect(WINDOW_AREAS).toContain(onboardingArea);
  });

  it("is offered once the quick start has asked, and Not now remembers it as skipped", async () => {
    const { tourState } = setUp("offer");
    expect(card().getAttribute("aria-labelledby")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Want a quick tour?" })).toBeTruthy();
    expect(document.activeElement).toBe(card());
    // Shown once: left unanswered (the window closes), it isn't offered again (#787 review).
    expect(tourState()).toBe("skipped");
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("region")).toBeNull();
    expect(tourState()).toBe("skipped");
  });

  it("isn't offered by itself otherwise", () => {
    setUp("new");
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("shows three steps and where help is, with Back, Next, Skip tour and Learn more", async () => {
    const { tourState, open } = setUp("offer");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Show me around" }));
    expect(tourState()).toBe("done");
    expect(screen.getByRole("heading", { name: "Change your words" })).toBeTruthy();
    expect(card().textContent).toContain("Step 1 of 3");
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Learn more: Editing on the page" }));
    expect(open).toHaveBeenCalledWith({ page: "editing-on-the-page" });

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "See it as visitors will" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Change your words" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Put it online" })).toBeTruthy();
    expect(card().textContent).toContain("Step 3 of 3");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Help is always here" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skip tour" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("region")).toBeNull();
    expect(tourState()).toBe("done");
  });

  it("starts from Help › Take the Tour at any time, and Esc skips it", async () => {
    const { commands, tourState } = setUp("skipped");
    expect(commands.get(COMMAND_IDS.tour)).toMatchObject({ label: "Take the Tour", menu: "help" });
    await act(async () => {
      await commands.run(COMMAND_IDS.tour);
    });
    expect(screen.getByRole("heading", { name: "Change your words" })).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("region")).toBeNull();
    // Taken, it stays done.
    expect(tourState()).toBe("done");
  });

  it("moves on from changing your words once the site has changed", async () => {
    const { commands, session } = setUp();
    await act(async () => {
      await commands.run(COMMAND_IDS.tour);
    });
    const page = session.history.document.getState().pages[session.ui.getState().pageId];
    act(() => {
      session.edit("props", "Edited Header text", (draft) => {
        const shown = draft.pages[session.ui.getState().pageId];
        if (shown !== undefined) shown.title = `${page?.title ?? ""} today`;
      });
    });
    expect(screen.getByRole("heading", { name: "See it as visitors will" })).toBeTruthy();
  });

  it("links each step to a help page that exists", () => {
    const pages = bundledHelpLibrary().pages;
    for (const step of TOUR_STEPS) {
      if (step.helpPage !== undefined) expect(pages.has(step.helpPage), step.id).toBe(true);
    }
  });

  it("is removed with the area", () => {
    const { commands, remove } = setUp("offer");
    remove();
    expect(commands.get(COMMAND_IDS.tour)).toBeUndefined();
  });
});

/** The first element on the page shown. */
const firstElement = (session: ReturnType<typeof sessionWith>) =>
  session.history.document.getState().pages[session.ui.getState().pageId]?.doc.content[0]?.props
    .id ?? null;

describe("the first-time tips (5.4a, OB-4…OB-6)", () => {
  it("shows a tip the first time its place is reached, once, closed with Got it", async () => {
    const { session, seen } = setUp();
    act(() => session.select(firstElement(session)));
    expect(screen.getByRole("heading", { name: "Change what you've selected" })).toBeTruthy();
    expect(card().textContent).toContain("Press Enter, or Edit on its bar");
    expect(seen()).toEqual(["selection"]);
    await userEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("region")).toBeNull();
    act(() => session.select(null));
    act(() => session.select(firstElement(session)));
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("shows the others where the areas say, and Content mode's on the first switch", async () => {
    const { places, preferences, seen } = setUp();
    act(() => places.reached("export"));
    expect(screen.getByRole("heading", { name: "Your website is a folder" })).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("region")).toBeNull();
    act(() => preferences.changeMode("content"));
    expect(screen.getByRole("heading", { name: "Content mode" })).toBeTruthy();
    expect(seen()).toEqual(["export", "contentMode"]);
  });

  it("shows one at a time, never over the tour; one that can't show waits for the next time", async () => {
    const { places, commands, seen } = setUp();
    act(() => places.reached("mustFix"));
    // Another while one shows: not shown, not seen.
    act(() => places.reached("themeStudio"));
    expect(seen()).toEqual(["mustFix"]);
    // The tour takes the tip's place, and no tip shows over it.
    await act(async () => {
      await commands.run(COMMAND_IDS.tour);
    });
    expect(screen.getByRole("heading", { name: "Change your words" })).toBeTruthy();
    act(() => places.reached("themeStudio"));
    expect(screen.queryByRole("heading", { name: "Themes change every page" })).toBeNull();
    await userEvent.keyboard("{Escape}");
    act(() => places.reached("themeStudio"));
    expect(screen.getByRole("heading", { name: "Themes change every page" })).toBeTruthy();
  });

  it("shows none while Show tips is off", () => {
    const { places, seen } = setUp("new", { showTips: false });
    act(() => places.reached("export"));
    expect(screen.queryByRole("region")).toBeNull();
    expect(seen()).toEqual([]);
  });
});

describe("offerTour (OB-1)", () => {
  it("asks for the offer the first time only", async () => {
    const set = vi.fn(async () => DEFAULT_PREFERENCES);
    await offerTour({ get: async () => DEFAULT_PREFERENCES, set });
    expect(set).toHaveBeenCalledWith({
      onboarding: { ...DEFAULT_PREFERENCES.onboarding, tour: "offer" },
    });
    set.mockClear();
    const answered = {
      ...DEFAULT_PREFERENCES,
      onboarding: { ...DEFAULT_PREFERENCES.onboarding, tour: "skipped" as const },
    };
    await offerTour({ get: async () => answered, set });
    expect(set).not.toHaveBeenCalled();
  });

  it("lets the site open even if the preferences can't be read", async () => {
    await expect(
      offerTour({ get: async () => Promise.reject(new Error("gone")), set: vi.fn() }),
    ).resolves.toBeUndefined();
  });
});
