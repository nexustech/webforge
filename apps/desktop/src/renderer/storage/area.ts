import type { Area, WindowContext } from "../editor/areas.js";
import { registerCrashReportsCommand } from "./crash-reports-command.js";

/** Help → Open Crash Reports (R3, 2.20, B1). */
export const crashReportsArea: Area<WindowContext> = {
  id: "crashReports",
  register: ({ commands }) => registerCrashReportsCommand(commands),
};
