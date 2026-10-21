import { siteLibrary } from "@webforge/site-components";
import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createEditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { connectCanvasSettings } from "./canvas-settings.js";
import { saveSiteSettings } from "./settings-form.js";

describe("connectCanvasSettings", () => {
  it("gives the canvas Site Settings values, again whenever they change, and hints for empty ones", () => {
    const session = createEditorSession(siteLibrary, starterSite());
    const engine = { setSettings: vi.fn() };
    const stop = connectCanvasSettings(engine, session);

    expect(engine.setSettings).toHaveBeenCalledTimes(1);
    const [setting, empty] = engine.setSettings.mock.calls[0] ?? [];
    expect(setting("general.name")).toBe("My site");
    expect(setting("contact.phone")).toBeUndefined();
    const hint = empty("contact.phone");
    expect(isValidElement(hint) && renderToStaticMarkup(hint)).toContain(
      "Add your phone number in Site Settings",
    );

    const settings = session.history.document.getState().settings;
    saveSiteSettings(session, { ...settings, contact: { ...settings.contact, phone: "+44 1" } });
    expect(engine.setSettings).toHaveBeenCalledTimes(2);
    expect(engine.setSettings.mock.calls[1]?.[0]("contact.phone")).toBe("+44 1");

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
});
