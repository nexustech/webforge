import type { Area, WindowContext } from "../editor/areas.js";
import { registerLayersPanel } from "./register-layers-panel.js";

/**
 * The Layers panel (2.20, B1). Content mode locks the layout in Layers too (M3). Registered once,
 * so switching modes keeps what the panel shows: its collapsed layers and filter.
 */
export const layersPanelArea: Area<WindowContext> = {
  id: "layersPanel",
  register: ({ panels, session, preferences, canvasPointer }) =>
    registerLayersPanel(panels, session, { preferences, canvas: canvasPointer }),
};
