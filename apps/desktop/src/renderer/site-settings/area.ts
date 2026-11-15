import type { Area, EditorContext, WindowContext } from "../editor/areas.js";
import { OnNetlify } from "../editor/window-services.js";
import { connectCanvasSettings } from "./canvas-settings.js";
import { registerSiteCode } from "./code-part.js";
import { registerSiteSettings } from "./site-part.js";

/** The open site's part of Settings, under *This site* (F-SET-1, LF-12). */
export const siteSettingsArea: Area<WindowContext> = {
  id: "siteSettings",
  uses: [OnNetlify],
  register: ({ settings, session, use }) => {
    const onNetlify = use(OnNetlify);
    return registerSiteSettings(settings, session, () => onNetlify.getState());
  },
};

/** The site's own code under *This site*, in Advanced mode (F-ED-15, 3.9). */
export const siteCodeArea: Area<WindowContext> = {
  id: "siteCode",
  register: ({ settings, session, preferences, commands }) =>
    registerSiteCode(settings, session, preferences, commands),
};

/** The Site Settings the canvas's elements show, such as the opening hours (2.20, B1). */
export const canvasSettingsArea: Area<EditorContext> = {
  id: "canvasSettings",
  register: ({ engine, session }) =>
    engine.whileMounted(({ engine: canvas }) => connectCanvasSettings(canvas, session)),
};
