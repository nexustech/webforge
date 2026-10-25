// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { createSettingsRegistry, registerAppSettings, SettingsHost } from "../settings/index.js";
import { CommandRegistryProvider } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createCommandRegistry } from "../shell/commands.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { sessionWith } from "../testing/fixtures.js";
import { registerSiteSettings } from "./site-part.js";

afterEach(cleanup);

// Drives the dialog through user-event, which is slow in happy-dom under coverage.
const SLOW = 15_000;

/** The window's Settings, with the app's parts and `session`'s site's, and its commands. */
function setUp(session = sessionWith()) {
  const commands = createCommandRegistry();
  const preferences = createPreferencesStore();
  const settings = createSettingsRegistry();
  registerAppSettings(settings, preferences);
  registerSiteSettings(settings, session);
  render(
    <CommandRegistryProvider registry={commands}>
      <SettingsHost registry={settings} />
    </CommandRegistryProvider>,
  );
  const run = (id: string) =>
    act(() => {
      commands.run(id);
    });
  return { commands, preferences, session, run, user: userEvent.setup({ delay: null }) };
}

describe("SettingsHost (LF-12)", () => {
  it("keeps Site Settings… off while no site's part is there (#432 review)", () => {
    const commands = createCommandRegistry();
    const settings = createSettingsRegistry();
    registerAppSettings(settings, createPreferencesStore());
    render(
      <CommandRegistryProvider registry={commands}>
        <SettingsHost registry={settings} />
      </CommandRegistryProvider>,
    );
    expect(commands.get(COMMAND_IDS.siteSettings)?.enabled).toBe(false);

    let remove: () => void = () => undefined;
    act(() => {
      remove = registerSiteSettings(settings, sessionWith());
    });
    expect(commands.get(COMMAND_IDS.siteSettings)?.enabled).toBe(true);
    act(() => remove());
    expect(commands.get(COMMAND_IDS.siteSettings)?.enabled).toBe(false);
  });

  it(
    "writes no preferences for devices saved as they were, whatever their keys' order (#432 review)",
    async () => {
      const { preferences, run, user } = setUp();
      act(() =>
        preferences.change({
          canvas: {
            ...preferences.getState().preferences.canvas,
            // Keys in another order than the form gives them back.
            devices: [{ height: 915, width: 412, name: "Pixel", id: "pixel" }],
          },
        }),
      );
      const before = preferences.getState().preferences;
      run(COMMAND_IDS.settings);
      await user.click(await screen.findByRole("button", { name: "Save" }));

      expect(preferences.getState().preferences).toBe(before);
    },
    SLOW,
  );

  it(
    "opens on App's Interface, saving the person's preferences, never an undo step",
    async () => {
      const { commands, preferences, session, run, user } = setUp();
      expect(commands.get(COMMAND_IDS.settings)).toMatchObject({
        label: "Settings…",
        menu: "file",
      });
      run(COMMAND_IDS.settings);

      const dialog = await screen.findByRole("dialog", { name: "Settings" });
      // Its sections down the side, under App and This site.
      expect(screen.getByRole("tab", { name: "Interface" }).getAttribute("aria-selected")).toBe(
        "true",
      );
      expect(screen.getByRole("tab", { name: "Devices" })).toBeDefined();
      expect(screen.getByRole("tab", { name: "General" })).toBeDefined();
      await user.selectOptions(screen.getByLabelText("Theme"), "light");
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(preferences.getState().preferences.theme).toBe("light");
      expect(session.history.state.getState().entries).toEqual([]);
      expect(dialog.isConnected).toBe(false);
    },
    SLOW,
  );

  it(
    "keeps the person's devices, adding one and renaming another",
    async () => {
      const { preferences, run, user } = setUp();
      act(() =>
        preferences.change({
          canvas: {
            ...preferences.getState().preferences.canvas,
            devices: [{ id: "pixel", name: "Pixel", width: 412, height: 915 }],
          },
        }),
      );
      run(COMMAND_IDS.settings);
      await user.click(await screen.findByRole("tab", { name: "Devices" }));
      await user.click(screen.getByRole("button", { name: "Add a device" }));
      await user.type(screen.getByLabelText("Name"), "Kiosk");
      await user.type(screen.getByLabelText("Width in pixels"), "1080");
      await user.type(screen.getByLabelText("Height in pixels"), "1920");
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(
        preferences
          .getState()
          .preferences.canvas.devices.map(({ id, ...size }) => [id === "pixel", size]),
      ).toEqual([
        [true, { name: "Pixel", width: 412, height: 915 }],
        [false, { name: "Kiosk", width: 1080, height: 1920 }],
      ]);
    },
    SLOW,
  );

  it(
    "opens Site Settings from the File menu command and saves them as one undo step",
    async () => {
      const { commands: registry, session, user } = setUp();

      expect(registry.get(COMMAND_IDS.siteSettings)).toMatchObject({
        label: "Site Settings…",
        menu: "file",
      });
      act(() => {
        registry.run(COMMAND_IDS.siteSettings);
      });
      await screen.findByRole("dialog");
      const name = await screen.findByLabelText("Site name");
      await user.clear(name);
      await user.type(name, "Rosa's");
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(session.history.document.getState().settings.general.name).toBe("Rosa's");
      expect(session.history.state.getState().entries.map((entry) => entry.label)).toEqual([
        "Changed Site Settings: General",
      ]);
      expect(screen.queryByRole("dialog")).toBeNull();
    },
    SLOW,
  );

  it(
    "saves adding, moving and removing opening hours as one undo step (PH2-13)",
    async () => {
      const { commands: registry, session, user } = setUp();
      act(() => {
        registry.run(COMMAND_IDS.siteSettings);
      });

      await user.click(await screen.findByRole("tab", { name: "Contact & hours" }));
      // Each added item opens: a day for each, as hours need one.
      const add = screen.getByRole("button", { name: "Add opening hours" });
      for (const day of ["Mon", "Tue", "Wed"]) {
        await user.click(add);
        await user.click(screen.getByRole("checkbox", { name: day }));
      }
      await user.click(
        screen.getAllByRole("button", { name: "Move Opening hours down" })[0] as HTMLElement,
      );
      await user.click(
        screen.getAllByRole("button", { name: "Remove these hours" })[2] as HTMLElement,
      );
      // Each row says its days and times.
      expect(
        screen.getAllByRole("button", { expanded: false }).map((row) => row.textContent),
      ).toEqual(["Tue · 09:00 · 17:00", "Mon · 09:00 · 17:00"]);
      // Nothing is a step until Save.
      expect(session.history.state.getState().entries).toEqual([]);
      await user.click(screen.getByRole("button", { name: "Save" }));

      // Monday moved below Tuesday, and Wednesday removed.
      expect(
        session.history.document.getState().settings.contact.openingHours.map(({ days }) => days),
      ).toEqual([["tue"], ["mon"]]);
      expect(session.history.state.getState().entries.map((entry) => entry.label)).toEqual([
        "Changed Site Settings: Contact & hours",
      ]);
    },
    SLOW,
  );
});
