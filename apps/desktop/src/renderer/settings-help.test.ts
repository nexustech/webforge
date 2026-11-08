import { combineForms } from "@webforge/editor-ui";
import { describe, expect, it } from "vitest";
import { createSettingsRegistry } from "./editor/settings-registry.js";
import { settingsHelpTopic } from "./help/index.js";
import { registerAppSettings } from "./settings/index.js";
import { createCommandRegistry } from "./shell/commands.js";
import { createPreferencesStore } from "./shell/preferences-store.js";
import { registerSiteCode } from "./site-settings/code-part.js";
import { registerSiteSettings } from "./site-settings/site-part.js";
import { sessionWith } from "./testing/fixtures.js";
import { registerVersionSettings } from "./versions/versions-settings.js";

// Across areas: every part of Settings, as the window registers them, against Help's **?** topics
// (5.4b). A section added without a topic fails here.

describe("Settings' ? links (5.4b)", () => {
  it("has a topic for every section of Settings, as the dialog lists them", () => {
    const settings = createSettingsRegistry();
    const preferences = createPreferencesStore({
      preferences: { ...createPreferencesStore().getState().preferences, editorLevel: "advanced" },
    });
    const session = sessionWith();
    registerAppSettings(settings, preferences, () => undefined);
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
