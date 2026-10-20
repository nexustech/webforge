import { describe, expect, it, vi } from "vitest";
import { createCommandRegistry } from "../shell/commands.js";
import { registerCrashReportsCommand } from "./crash-reports-command.js";

describe("registerCrashReportsCommand", () => {
  it("adds Help → Open Crash Reports Folder, which asks main to show the folder", async () => {
    const registry = createCommandRegistry();
    const app = { openCrashReports: vi.fn(async () => null) };

    const unregister = registerCrashReportsCommand(registry, app);

    const command = registry.get("help.openCrashReports");
    expect(command).toMatchObject({ label: "Open Crash Reports Folder", menu: "help" });
    await command?.run();
    expect(app.openCrashReports).toHaveBeenCalledTimes(1);
    unregister();
    expect(registry.get("help.openCrashReports")).toBeUndefined();
  });
});
