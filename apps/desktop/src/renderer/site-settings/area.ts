import type { Area, EditorContext } from "../editor/areas.js";
import { connectCanvasSettings } from "./canvas-settings.js";

/** The Site Settings the canvas's elements show, such as the opening hours (2.20, B1). */
export const canvasSettingsArea: Area<EditorContext> = {
  id: "canvasSettings",
  register: ({ engine, session }) =>
    engine.whileMounted(({ engine: canvas }) => connectCanvasSettings(canvas, session)),
};
