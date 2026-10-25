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
  it("leaves its menus to the system's menu bar when it has one (macOS, LF-13)", () => {
    const registry = createCommandRegistry();
    registry.register({ id: "site.settings", label: "Site Settings…", menu: "file", run: vi.fn() });
    const menuBar = {
      setNativeMenus: vi.fn(async () => null),
      onRunCommand: vi.fn(() => () => undefined),
    };
    render(
      <CommandRegistryProvider registry={registry}>
        <TooltipProvider>
          <TitleBar siteName="Bloom Bakery" menuBar={menuBar} />
        </TooltipProvider>
      </CommandRegistryProvider>,
    );

    expect(screen.queryByRole("menubar")).toBeNull();
    expect(menuBar.setNativeMenus).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "file", label: "File" })]),
    );
  });

  it("is the window's banner, with the app name as its heading and the save status", () => {
    renderTitleBar();

    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("heading", { level: 1, name: "Webforge" })).toBeTruthy();
    expect(within(banner).getByText("Saved")).toBeTruthy();
  });

  it("disables buttons whose commands nobody has registered yet", () => {
    renderTitleBar();

    // Icon-only buttons (LF-13) keep their names before the editor registers them.
    for (const name of ["New", "Open", "Undo", "Redo", "Preview", "Export", "Publish"]) {
      const button = screen.getByRole("button", { name }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.textContent).toBe("");
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
    registry.register({ id: COMMAND_IDS.undo, label: "Undo", run: undo });
    renderTitleBar(registry);

    // Named by its command once registered.
    await userEvent.click(screen.getByRole("button", { name: "Export Site…" }));
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

  it("opens from its own command (Ctrl/Cmd+P, and Ctrl/Cmd+K) and says when nothing matches", async () => {
    const registry = renderTitleBar();

    act(() => {
      registry.run("view.commandBox");
    });
    await userEvent.type(await screen.findByRole("combobox"), "zzz");

    expect(screen.getByText("No matching commands")).toBeTruthy();
    expect(registry.get("view.commandBox")?.shortcut).toBe("Mod+P");
    expect(registry.get("view.commandBox")?.extraShortcuts).toEqual(["Mod+K"]);
  });

  it("groups commands, pages to go to and things to add, an Add with nowhere to go shown off", async () => {
    const registry = createCommandRegistry();
    const showAbout = vi.fn();
    const addHero = vi.fn();
    registry.register({
      id: "help.openCrashReports",
      label: "Open Crash Reports Folder",
      run: vi.fn(),
    });
    registry.register({
      id: "page.goto.about",
      label: "About",
      palette: "pages",
      keywords: ["about-us"],
      run: showAbout,
    });
    registry.register({ id: "add.item.Hero", label: "Add Hero", palette: "add", run: addHero });
    registry.register({
      id: "add.item.Text",
      label: "Add Text",
      palette: "add",
      enabled: false,
      run: vi.fn(),
    });
    renderTitleBar(registry);

    act(() => {
      registry.run("view.commandBox");
    });
    // Each group is named by its heading.
    const groups = (await screen.findAllByRole("group")).map((group) => [
      document.getElementById(group.getAttribute("aria-labelledby") ?? "")?.textContent,
      within(group)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ]);
    expect(groups).toEqual([
      ["Commands", ["Open Crash Reports Folder", "About Webforge"]],
      ["Go to page", ["About"]],
      ["Add", ["Add Hero", "Add Text"]],
    ]);
    expect(screen.getByRole("option", { name: "Add Text" }).getAttribute("aria-disabled")).toBe(
      "true",
    );

    // Found by name, never by id: "add hero" is spread through "…Folder help.openCrashReports".
    await userEvent.type(screen.getByRole("combobox"), "add hero");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Add Hero"]);
    await userEvent.clear(screen.getByRole("combobox"));

    // A page is found by its file name too.
    await userEvent.type(screen.getByRole("combobox"), "about-us");
    await userEvent.keyboard("{Enter}");
    expect(showAbout).toHaveBeenCalledOnce();
    expect(addHero).not.toHaveBeenCalled();
  });
});
