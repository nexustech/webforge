import type { TemplatesApi } from "../../shared/ipc/templates.js";
import type { Call } from "./call.js";

/** `window.webforge.templates`. */
export const templatesApi = (call: Call): TemplatesApi => ({
  list: () => call("listTemplates"),
});
