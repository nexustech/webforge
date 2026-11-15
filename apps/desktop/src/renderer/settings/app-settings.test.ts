import { describe, expect, it } from "vitest";
import { createSettingsRegistry } from "../editor/settings-registry.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { registerAppSettings } from "./app-settings.js";

/** The part `id` of Settings › App as the window opens it, for an app at `version`. */
function appPart(id: string, version: string, preferences = createPreferencesStore()) {
  const registry = createSettingsRegistry();
  registerAppSettings(registry, preferences, () => undefined, version);
  const part = registry
    .list()
    .flatMap((entry) => entry.open() ?? [])
    .find((each) => each.form.id === id);
  if (part === undefined) throw new Error(`no ${id} part`);
  return { part, preferences };
}

/** Settings › App › Updates as the window opens it, for an app at `version`. */
const updatesPart = (version: string, preferences = createPreferencesStore()) =>
  appPart("updates", version, preferences);

describe("Settings › App › Interface › Text size (#1015)", () => {
  /** What Interface's own schema makes of its values with `textSize` as chosen. */
  const output = (textSize: string) => {
    const { part } = appPart("interface", "1.0.0");
    const { spec, initial } = part.form;
    return spec.schema.safeParse(spec.toModel({ ...initial, textSize }));
  };

  it("offers the interface zoom's levels, starting at the one in use", () => {
    const preferences = createPreferencesStore();
    preferences.change({ interfaceZoom: 1.25 });
    const { part } = appPart("interface", "1.0.0", preferences);
    expect(part.form.initial).toMatchObject({ textSize: "1.25" });
    const field = (
      typeof part.form.spec.fields === "function"
        ? part.form.spec.fields(part.form.initial)
        : part.form.spec.fields
    ).find((each) => each.name === "textSize");
    expect(field).toMatchObject({
      kind: "select",
      label: "Text size",
      options: [
        { label: "80%", value: "0.8" },
        { label: "90%", value: "0.9" },
        { label: "100% (standard)", value: "1" },
        { label: "110%", value: "1.1" },
        { label: "125%", value: "1.25" },
        { label: "150%", value: "1.5" },
      ],
    });
  });

  it("saves the level as the interface zoom, and nothing that isn't a level", () => {
    expect(output("1.1")).toMatchObject({ success: true, data: { textSize: 1.1 } });
    expect(output("1.2").success).toBe(false);

    const { part, preferences } = appPart("interface", "1.0.0");
    part.save({ ...part.form.initial, showAgain: false, showTips: true, textSize: 1.1 });
    expect(preferences.getState().preferences.interfaceZoom).toBe(1.1);
  });

  it("leaves the zoom alone when Save keeps the size it had", () => {
    const { part, preferences } = appPart("interface", "1.0.0");
    let changes = 0;
    preferences.subscribe(() => {
      changes += 1;
    });
    part.save({ ...part.form.initial, showAgain: false, showTips: true, textSize: 1 });
    expect(changes).toBe(0);
  });
});

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
