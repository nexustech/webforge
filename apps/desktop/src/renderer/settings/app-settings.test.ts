import { describe, expect, it } from "vitest";
import { createSettingsRegistry } from "../editor/settings-registry.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { registerAppSettings } from "./app-settings.js";

/** Settings › App › Updates as the window opens it, for an app at `version`. */
function updatesPart(version: string, preferences = createPreferencesStore()) {
  const registry = createSettingsRegistry();
  registerAppSettings(registry, preferences, () => undefined, version);
  const part = registry
    .list()
    .flatMap((entry) => entry.open() ?? [])
    .find((each) => each.form.id === "updates");
  if (part === undefined) throw new Error("no Updates part");
  return { part, preferences };
}

describe("Settings › App › Updates (5.2)", () => {
  it("shows the channel the version follows until the person chooses one", () => {
    expect(updatesPart("0.9.0").part.form.initial).toEqual({ channel: "beta" });
    expect(updatesPart("1.0.0").part.form.initial).toEqual({ channel: "stable" });
  });

  it("keeps only a choice: Save with the channel as it was stores nothing", () => {
    const { part, preferences } = updatesPart("0.9.0");
    part.save({ channel: "beta" });
    expect(preferences.getState().preferences).not.toHaveProperty("updateChannel");

    part.save({ channel: "stable" });
    expect(preferences.getState().preferences.updateChannel).toBe("stable");
    // From then on, the choice is what Settings shows.
    expect(updatesPart("0.9.0", preferences).part.form.initial).toEqual({ channel: "stable" });
  });
});
