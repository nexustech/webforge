import type { Area, EditorContext } from "../editor/areas.js";
import { connectCanvasImages } from "./canvas-images.js";
import { registerMediaPanel } from "./register-media-panel.js";

/** The canvas's images, from the site's Media (2.20, B1). */
export const canvasImagesArea: Area<EditorContext> = {
  id: "canvasImages",
  register: ({ engine, session }) =>
    engine.whileMounted(({ engine: canvas }) => connectCanvasImages(canvas, session)),
};

/** The Media panel (2.20, B1). */
export const mediaPanelArea: Area<EditorContext> = {
  id: "mediaPanel",
  register: ({ api, panels, session }) => registerMediaPanel(panels, session, api.media),
};
