import type { Area, EditorContext } from "../editor/areas.js";
import { connectCanvasNavigation } from "./canvas-navigation.js";

/** The canvas's navigation, from the site's menu (2.20, B1). */
export const canvasNavigationArea: Area<EditorContext> = {
  id: "canvasNavigation",
  register: ({ engine, session }) =>
    engine.whileMounted(({ engine: canvas }) => connectCanvasNavigation(canvas, session)),
};
