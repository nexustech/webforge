import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it, vi } from "vitest";
import { createEditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { createCommandRegistry } from "../shell/commands.js";
import { registerClipboardCommands } from "./register-clipboard-commands.js";

describe("registerClipboardCommands", () => {
  const setup = () => {
    const registry = createCommandRegistry();
    const session = createEditorSession(siteLibrary, starterSite());
    const clipboard = {
      write: vi.fn(async () => ({ status: "copied" }) as const),
      read: vi.fn(async () => ({ status: "empty" }) as const),
    };
    const commands = registerClipboardCommands(registry, session, clipboard, vi.fn(), vi.fn());
    const enabled = () =>
      ["edit.cut", "edit.copy", "edit.paste"].map((id) => registry.get(id)?.enabled ?? true);
    return { registry, session, clipboard, commands, enabled };
  };

  it("puts Cut, Copy and Paste in the Edit menu, Cut and Copy for a selection only", () => {
    const { registry, commands, enabled } = setup();

    expect(registry.list().map((command) => [command.id, command.menu, command.shortcut])).toEqual([
      ["edit.cut", "edit", "Mod+X"],
      ["edit.copy", "edit", "Mod+C"],
      ["edit.paste", "edit", "Mod+V"],
    ]);
    expect(enabled()).toEqual([false, false, true]);
    commands.setHasSelection(true);
    expect(enabled()).toEqual([true, true, true]);
  });

  it("turns Cut and Paste off while Content mode locks the layout; Copy still works", () => {
    const { commands, enabled } = setup();
    commands.setHasSelection(true);

    commands.setLayoutLocked(true);
    expect(enabled()).toEqual([false, true, false]);
    commands.setLayoutLocked(false);
    expect(enabled()).toEqual([true, true, true]);
  });

  it("copies the selected element when Copy runs, and stops when removed", async () => {
    const { registry, session, clipboard, commands } = setup();
    session.ui.setState({ nodeId: "heading-1" });
    commands.setHasSelection(true);

    registry.run("edit.copy");
    await vi.waitFor(() => expect(clipboard.write).toHaveBeenCalledOnce());

    commands.remove();
    expect(registry.list()).toEqual([]);
  });
});
