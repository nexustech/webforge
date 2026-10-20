import type { CanvasApi } from "../../shared/ipc/canvas.js";
import type { Call } from "./call.js";

/** `window.webforge.canvas`. */
export const canvasApi = (call: Call): CanvasApi => ({
  compileCss: (request) => call("compileCanvasCss", request),
});
