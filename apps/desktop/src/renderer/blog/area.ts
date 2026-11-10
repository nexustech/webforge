import type { Area, EditorContext } from "../editor/areas.js";
import { connectCanvasItem } from "./canvas-item.js";

/** The fields of the post shown, in its Blog's design on the canvas (6.10a). */
export const canvasItemArea: Area<EditorContext> = {
  id: "canvasItem",
  register: ({ engine, session }) =>
    engine.whileMounted(({ engine: canvas }) => connectCanvasItem(canvas, session)),
};
