// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { combineForms, TooltipProvider } from "@webforge/editor-ui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSettingsRegistry } from "../editor/settings-registry.js";
import { registerAppSettings } from "../settings/index.js";
import { createCommandRegistry } from "../shell/commands.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { registerSiteCode } from "../site-settings/code-part.js";
import { registerSiteSettings } from "../site-settings/site-part.js";
import { sessionWith } from "../testing/fixtures.js";
import { registerVersionSettings } from "../versions/versions-settings.js";
import { HelpButton, HelpProvider, settingsHelpTopic } from "./HelpButton.js";

afterEach(cleanup);

describe("HelpButton (5.4b)", () => {
  it("opens the Help window at its topic's page and heading, named for it", async () => {
    const open = vi.fn();
    render(
      <TooltipProvider>
        <HelpProvider open={open}>
          <HelpButton topic="pageSettings" />
          <HelpButton topic="siteCheck.tip" about="Large downloads" />
        </HelpProvider>
      </TooltipProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Help: Page Settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Help: Large downloads" }));
    expect(open.mock.calls).toEqual([
      [{ page: "pages", anchor: "page-settings" }],
      [{ page: "site-check", anchor: "tips" }],
    ]);
  });

  it("isn't drawn where Help can't open", () => {
    const { container } = render(<HelpButton topic="export" />);
    expect(container.innerHTML).toBe("");
  });

  it("has a topic for every section of Settings, as the dialog lists them", () => {
    const settings = createSettingsRegistry();
    const preferences = createPreferencesStore({
      preferences: { ...createPreferencesStore().getState().preferences, editorLevel: "advanced" },
    });
    const session = sessionWith();
    registerAppSettings(settings, preferences);
    registerVersionSettings(settings, preferences);
    registerSiteSettings(settings, session);
    registerSiteCode(settings, session, preferences, createCommandRegistry());
    const parts = settings.list().flatMap((entry) => entry.open() ?? []);
    const groups = (combineForms(parts.map((part) => part.form)).spec.groups ?? []).map(
      (group) => group.id,
    );

    expect(groups).toContain("site:general");
    expect(groups).toContain("code:code");
    expect(groups.filter((group) => settingsHelpTopic(group) === undefined)).toEqual([]);
    expect(settingsHelpTopic("nowhere:at-all")).toBeUndefined();
  });
});
