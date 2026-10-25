import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { sessionWith } from "../testing/fixtures.js";
import { connectCanvasSettings } from "./canvas-settings.js";
import { saveSiteSettings } from "./settings-form.js";

/** What the canvas was given in its `index`th call of `setSettings`. */
function bindingsGiven(setSettings: ReturnType<typeof vi.fn>, index: number) {
  const args = setSettings.mock.calls[index];
  if (args === undefined) throw new Error(`No call ${index} of setSettings`);
  return args[0];
}

describe("connectCanvasSettings", () => {
  it("gives the canvas Site Settings values, again whenever they change, and hints for empty ones", () => {
    const session = sessionWith();
    const engine = { setSettings: vi.fn() };
    const stop = connectCanvasSettings(engine, session);

    expect(engine.setSettings).toHaveBeenCalledTimes(1);
    const { setting, emptySetting: empty } = bindingsGiven(engine.setSettings, 0);
    expect(setting("general.name")).toBe("My site");
    expect(setting("contact.phone")).toBeUndefined();
    const hint = empty("contact.phone");
    expect(isValidElement(hint) && renderToStaticMarkup(hint)).toContain(
      "Add your phone number in Site Settings",
    );

    const settings = session.history.document.getState().settings;
    saveSiteSettings(session, { ...settings, contact: { ...settings.contact, phone: "+44 1" } });
    expect(engine.setSettings).toHaveBeenCalledTimes(2);
    expect(bindingsGiven(engine.setSettings, 1).setting("contact.phone")).toBe("+44 1");

    // Other changes don't draw the page again.
    session.edit("page", "Renamed page", (draft) => {
      const home = draft.pages[draft.homePageId];
      if (home !== undefined) home.title = "Start";
    });
    expect(engine.setSettings).toHaveBeenCalledTimes(2);

    stop();
    saveSiteSettings(session, { ...settings, contact: { ...settings.contact, phone: "+44 2" } });
    expect(engine.setSettings).toHaveBeenCalledTimes(2);
  });

  it("gives the canvas the opening hours too, again when they change (2.8)", () => {
    const session = sessionWith();
    const engine = { setSettings: vi.fn() };
    connectCanvasSettings(engine, session);
    expect(bindingsGiven(engine.setSettings, 0).openingHours).toEqual([]);

    const settings = session.history.document.getState().settings;
    const openingHours = [{ days: ["sat" as const], opens: "08:00", closes: "13:00" }];
    saveSiteSettings(session, { ...settings, contact: { ...settings.contact, openingHours } });

    expect(bindingsGiven(engine.setSettings, 1).openingHours).toEqual(openingHours);
  });

  it("gives the canvas the social profiles, again when they change, and a hint without any (2.9b)", () => {
    const session = sessionWith();
    const engine = { setSettings: vi.fn() };
    connectCanvasSettings(engine, session);
    const first = bindingsGiven(engine.setSettings, 0);
    expect(first.socialProfiles).toEqual([]);
    const hint = first.socialHint();
    expect(isValidElement(hint) && renderToStaticMarkup(hint)).toContain(
      "Add your social profiles in Site Settings",
    );

    const settings = session.history.document.getState().settings;
    const profiles = [{ network: "github" as const, url: "https://github.com/ourbakery" }];
    saveSiteSettings(session, { ...settings, social: { ...settings.social, profiles } });

    expect(bindingsGiven(engine.setSettings, 1).socialProfiles).toEqual(profiles);
  });

  it("gives the canvas the site's language and form service, and a hint without one (2.8)", () => {
    const session = sessionWith();
    const engine = { setSettings: vi.fn() };
    connectCanvasSettings(engine, session);
    const first = bindingsGiven(engine.setSettings, 0);
    expect(first.language).toBe(session.history.document.getState().settings.general.language);
    expect(first.formService).toBeUndefined();
    expect(renderToStaticMarkup(first.formHint("noService"))).toContain(
      "Choose where submissions go in Site Settings",
    );
    expect(renderToStaticMarkup(first.formHint("insecure"))).toContain("must start with https://");
    expect(renderToStaticMarkup(first.formHint("netlify"))).toContain("Netlify Forms");

    const settings = session.history.document.getState().settings;
    const service = { kind: "formspree" as const, formId: "xyzAbc12" };
    saveSiteSettings(session, { ...settings, forms: { service } });

    expect(bindingsGiven(engine.setSettings, 1).formService).toEqual(service);
  });
});
