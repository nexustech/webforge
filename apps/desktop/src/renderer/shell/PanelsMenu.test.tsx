// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@webforge/editor-ui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandRegistryProvider } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { createCommandRegistry } from "./commands.js";
import { PanelsMenu } from "./PanelsMenu.js";

afterEach(() => cleanup());

describe("PanelsMenu (#1195)", () => {
  it("lists the columns and the bottom panel as checkboxes with their shortcuts, ticked while shown", async () => {
    const registry = createCommandRegistry();
    const right = vi.fn();
    registry.register({
      id: COMMAND_IDS.toggleLeftPanels,
      label: "Show or Hide Left Panels",
      checked: false,
      run: vi.fn(),
    });
    registry.register({
      id: COMMAND_IDS.toggleDrawer,
      label: "Show or Hide Bottom Panel",
      checked: false,
      run: vi.fn(),
    });
    registry.register({
      id: COMMAND_IDS.toggleRightPanels,
      label: "Show or Hide Right Panels",
      checked: true,
      run: right,
    });
    render(
      <CommandRegistryProvider registry={registry}>
        <TooltipProvider>
          <PanelsMenu />
        </TooltipProvider>
      </CommandRegistryProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Show or hide panels" }));
    const items = screen.getAllByRole("menuitemcheckbox");
    expect(items.map((item) => [item.textContent, item.getAttribute("aria-checked")])).toEqual([
      [expect.stringMatching(/^Left Panels/), "false"],
      [expect.stringMatching(/^Bottom Panel/), "false"],
      [expect.stringMatching(/^Right Panels/), "true"],
    ]);

    // With its shortcut: the standard one for each.
    expect(items[1]?.textContent).toMatch(/Ctrl\+J$|⌘J$/);
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: /^Right Panels/ }));
    expect(right).toHaveBeenCalledOnce();
  });

  it("shows nothing before the panels' commands are registered, as on the start screen", () => {
    const { container } = render(
      <CommandRegistryProvider registry={createCommandRegistry()}>
        <PanelsMenu />
      </CommandRegistryProvider>,
    );
    expect(container.textContent).toBe("");
  });
});
