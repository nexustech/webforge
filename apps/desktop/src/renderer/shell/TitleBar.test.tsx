// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@webforge/editor-ui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AboutDialog } from "./AboutDialog.js";
import { CommandRegistryProvider } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { type CommandRegistry, createCommandRegistry } from "./commands.js";
import { TitleBar } from "./TitleBar.js";

afterEach(() => cleanup());

function renderTitleBar(registry: CommandRegistry = createCommandRegistry()) {
  render(
    <CommandRegistryProvider registry={registry}>
      <TooltipProvider>
        <TitleBar siteName="Bloom Bakery" saveStatus={<span>Saved</span>} />
        <AboutDialog info={{ name: "Webforge", version: "1.2.0" }} />
      </TooltipProvider>
    </CommandRegistryProvider>,
  );
  return registry;
}

describe("TitleBar", () => {
  it("is the window's banner, with the app name as its heading and the save status", () => {
    renderTitleBar();

    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("heading", { level: 1, name: "Webforge" })).toBeTruthy();
    expect(within(banner).getByText("Saved")).toBeTruthy();
  });

  it("disables buttons whose commands nobody has registered yet", () => {
    renderTitleBar();

    // Icon-only Undo and Redo keep their names before the editor registers them.
    for (const name of ["New", "Open", "Undo", "Redo", "Preview", "Export", "Publish"]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("runs a registered command from its button, and labels icon buttons with the command", async () => {
    const registry = createCommandRegistry();
    const exportSite = vi.fn();
    const undo = vi.fn();
    registry.register({
      id: COMMAND_IDS.exportSite,
      label: "Export Site…",
      run: exportSite,
    });
    registry.register({ id: COMMAND_IDS.undo, label: "Undo", shortcut: "Mod+Z", run: undo });
    renderTitleBar(registry);

    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(exportSite).toHaveBeenCalledOnce();
    expect(undo).toHaveBeenCalledOnce();
  });

  it("follows a command becoming disabled", () => {
    const registry = createCommandRegistry();
    registry.register({ id: COMMAND_IDS.redo, label: "Redo", run: vi.fn() });
    renderTitleBar(registry);

    act(() => registry.update(COMMAND_IDS.redo, { enabled: false }));

    expect((screen.getByRole("button", { name: "Redo" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("lists commands in the app menu, by menu", async () => {
    const registry = createCommandRegistry();
    const exportSite = vi.fn();
    registry.register({
      id: COMMAND_IDS.exportSite,
      label: "Export Site…",
      menu: "file",
      shortcut: "Mod+E",
      run: exportSite,
    });
    registry.register({
      id: "a.disabled",
      label: "Later",
      menu: "file",
      enabled: false,
      run: vi.fn(),
    });
    renderTitleBar(registry);

    await userEvent.click(screen.getByRole("menuitem", { name: "File" }));
    expect(screen.getByRole("menuitem", { name: "Later" }).getAttribute("aria-disabled")).toBe(
      "true",
    );
    await userEvent.click(screen.getByRole("menuitem", { name: /Export Site…/ }));

    expect(exportSite).toHaveBeenCalledOnce();
    // Help holds About; menus without commands aren't shown.
    expect(screen.getByRole("menuitem", { name: "Help" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Edit" })).toBeNull();
  });

  it("shows the app version in Help → About Webforge", async () => {
    const registry = renderTitleBar();

    act(() => {
      registry.run("help.about");
    });

    const dialog = await screen.findByRole("dialog", { name: "Webforge" });
    expect(within(dialog).getByText("Version 1.2.0")).toBeTruthy();
  });
});

describe("CommandBox", () => {
  it("shows the site name and finds and runs a command by typing", async () => {
    const registry = createCommandRegistry();
    const exportSite = vi.fn();
    registry.register({
      id: COMMAND_IDS.exportSite,
      label: "Export Site…",
      run: exportSite,
    });
    registry.register({ id: "x.off", label: "Unavailable", enabled: false, run: vi.fn() });
    renderTitleBar(registry);

    const box = screen.getByRole("button", { name: /^Search commands/ });
    expect(box.textContent).toContain("Bloom Bakery");
    await userEvent.click(box);
    expect(screen.queryByRole("option", { name: "Unavailable" })).toBeNull();
    await userEvent.type(screen.getByRole("combobox"), "export");
    await userEvent.keyboard("{Enter}");

    expect(exportSite).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens from its own command (Ctrl/Cmd+K) and says when nothing matches", async () => {
    const registry = renderTitleBar();

    act(() => {
      registry.run("view.commandBox");
    });
    await userEvent.type(await screen.findByRole("combobox"), "zzz");

    expect(screen.getByText("No matching commands")).toBeTruthy();
    expect(registry.get("view.commandBox")?.shortcut).toBe("Mod+K");
  });
});
