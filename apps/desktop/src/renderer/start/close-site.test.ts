import { toast } from "@webforge/editor-ui";
import { describe, expect, it, vi } from "vitest";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createCommandRegistry } from "../shell/commands.js";
import { registerCloseSiteCommand } from "./close-site.js";

vi.mock("@webforge/editor-ui", () => ({ toast: { error: vi.fn() } }));
vi.mock("../log.js", () => ({ reportFailure: vi.fn() }));

describe("File › Close Site (#1016)", () => {
  it("closes the site, then starts the window over on the start screen", async () => {
    const registry = createCommandRegistry();
    const order: string[] = [];
    const close = vi.fn(async () => {
      order.push("closed");
      return null;
    });
    const restart = vi.fn(() => {
      order.push("restarted");
    });
    registerCloseSiteCommand(registry, close, restart);

    expect(registry.get(COMMAND_IDS.closeSite)).toMatchObject({
      label: "Close Site",
      menu: "file",
    });
    await registry.run(COMMAND_IDS.closeSite);
    expect(order).toEqual(["closed", "restarted"]);
  });

  it("says so when the site can't be closed, and leaves it open with the command on", async () => {
    const registry = createCommandRegistry();
    const restart = vi.fn();
    registerCloseSiteCommand(
      registry,
      async () => {
        throw new Error("refused");
      },
      restart,
    );

    await registry.run(COMMAND_IDS.closeSite);
    expect(restart).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("The site couldn't be closed. Try again.");
    expect(registry.get(COMMAND_IDS.closeSite)?.enabled).not.toBe(false);
  });
});
