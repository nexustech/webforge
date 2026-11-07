// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES, type OnboardingPreferences } from "../../shared/ipc/prefs.js";
import { WINDOW_AREAS } from "../areas.js";
import type { WindowContext } from "../editor/areas.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { createWindowDialogs, WindowDialogs } from "../shell/window-dialogs.js";
import { registriesForTest, sessionWith } from "../testing/fixtures.js";
import { fakePreloadApi } from "../testing/preload.js";
import { onboardingArea } from "./area.js";
import { offerTour } from "./offer.js";

afterEach(cleanup);

/** The window with the onboarding area registered, the tour as `tour` left it. */
function setUp(tour: OnboardingPreferences["tour"] = "new") {
  const registries = registriesForTest();
  const saved = vi.fn(async () => undefined);
  const preferences = createPreferencesStore(
    {
      preferences: {
        ...DEFAULT_PREFERENCES,
        onboarding: { ...DEFAULT_PREFERENCES.onboarding, tour },
      },
    },
    { preferences: saved },
  );
  const session = sessionWith();
  const windowDialogs = createWindowDialogs();
  const open = vi.fn(async () => true);
  const remove = onboardingArea.register({
    ...registries,
    preferences,
    session,
    windowDialogs,
    api: fakePreloadApi({ help: { open } }),
  } as unknown as WindowContext);
  render(<WindowDialogs registry={windowDialogs} />);
  const tourState = () => preferences.getState().preferences.onboarding.tour;
  return { commands: registries.commands, session, open, remove, tourState, saved };
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

  it("is removed with the area", () => {
    const { commands, remove } = setUp("offer");
    remove();
    expect(commands.get(COMMAND_IDS.tour)).toBeUndefined();
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
