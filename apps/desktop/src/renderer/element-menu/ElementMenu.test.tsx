// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorSession, currentPage } from "../editor/editor-session.js";
import { createFakeEngine } from "../editor/fake-engine.test-helper.js";
import { starterSite } from "../editor/starter-site.js";
import { CommandRegistryProvider } from "../shell/command-context.js";
import { createCommandRegistry } from "../shell/commands.js";
import { CanvasElementMenu } from "./CanvasElementMenu.js";
import { ELEMENT_MENU_COMMANDS, ElementMenu } from "./ElementMenu.js";

afterEach(cleanup);

/** The registry with the menu's commands, Save as shared section and Detach as given. */
function registry(shared: { save: boolean; detach: boolean }) {
  const commands = createCommandRegistry();
  const run = vi.fn();
  commands.register({
    id: ELEMENT_MENU_COMMANDS.duplicate,
    label: "Duplicate",
    shortcut: "Mod+D",
    run: () => run("duplicate"),
  });
  commands.register({
    id: ELEMENT_MENU_COMMANDS.saveShared,
    label: "Save as shared section…",
    enabled: shared.save,
    run: () => run("save"),
  });
  commands.register({
    id: ELEMENT_MENU_COMMANDS.detachShared,
    label: "Detach from shared section",
    enabled: shared.detach,
    run: () => run("detach"),
  });
  commands.register({
    id: ELEMENT_MENU_COMMANDS.remove,
    label: "Delete",
    enabled: false,
    run: () => run("delete"),
  });
  return { commands, run };
}

const menu = () => within(screen.getByRole("menu", { name: "Element actions" }));
const items = () =>
  menu()
    .getAllByRole("menuitem")
    .map((item) => [item.textContent, item.getAttribute("aria-disabled") === "true"]);

describe("ElementMenu (1.35)", () => {
  it("lists Rename, Duplicate, Save as shared section and Delete, as their commands allow", async () => {
    const { commands, run } = registry({ save: true, detach: false });
    const onRename = vi.fn();
    render(
      <CommandRegistryProvider registry={commands}>
        <ElementMenu at={{ x: 10, y: 20 }} onClose={vi.fn()} onRename={onRename} />
      </CommandRegistryProvider>,
    );

    expect(items()).toEqual([
      ["Rename", false],
      ["DuplicateCtrl+D", false],
      ["Save as shared section…", false],
      ["Delete", true],
    ]);
    await userEvent.click(menu().getByRole("menuitem", { name: /Duplicate/ }));
    expect(run).toHaveBeenCalledWith("duplicate");
  });

  it("offers Detach for a linked copy, and no Rename where there is no layer to name", () => {
    const { commands } = registry({ save: false, detach: true });
    render(
      <CommandRegistryProvider registry={commands}>
        <ElementMenu at={{ x: 0, y: 0 }} onClose={vi.fn()} onRename={undefined} />
      </CommandRegistryProvider>,
    );

    expect(items()).toEqual([
      ["Rename", true],
      ["DuplicateCtrl+D", false],
      ["Detach from shared section", false],
      ["Delete", true],
    ]);
  });

  it("is closed while it has no point", () => {
    const { commands } = registry({ save: false, detach: false });
    render(
      <CommandRegistryProvider registry={commands}>
        <ElementMenu at={null} onClose={vi.fn()} onRename={vi.fn()} />
      </CommandRegistryProvider>,
    );

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("offers Copy Style and Paste Style once they are registered (1.37)", () => {
    const { commands } = registry({ save: true, detach: false });
    commands.register({ id: "edit.copyStyle", label: "Copy Style", run: vi.fn() });
    commands.register({
      id: "edit.pasteStyle",
      label: "Paste Style (onto a Heading)",
      enabled: false,
      run: vi.fn(),
    });
    render(
      <CommandRegistryProvider registry={commands}>
        <ElementMenu at={{ x: 0, y: 0 }} onClose={vi.fn()} onRename={vi.fn()} />
      </CommandRegistryProvider>,
    );

    expect(items().slice(3, 5)).toEqual([
      ["Copy Style", false],
      ["Paste Style (onto a Heading)", true],
    ]);
  });
});

describe("CanvasElementMenu (1.35)", () => {
  function setUp() {
    const session = createEditorSession(siteLibrary, starterSite());
    const engine = createFakeEngine();
    const { commands } = registry({ save: true, detach: false });
    render(
      <CommandRegistryProvider registry={commands}>
        <CanvasElementMenu engine={engine} session={session} />
      </CommandRegistryProvider>,
    );
    return { session, engine };
  }

  it("selects a right-clicked element and opens the menu there; Rename names its layer", async () => {
    const { session, engine } = setUp();

    act(() => engine.rightClick({ nodeId: "heading-1", x: 40, y: 50 }));

    expect(session.ui.getState().nodeId).toBe("heading-1");
    await userEvent.click(menu().getByRole("menuitem", { name: "Rename" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Rename Heading" }));
    await userEvent.type(dialog.getByRole("textbox", { name: "Name for this Heading" }), "Intro");
    await userEvent.click(dialog.getByRole("button", { name: "Rename" }));

    const section = currentPage(session)?.doc.content[0];
    const content = section?.props.content as { props: { layerName?: string } }[] | undefined;
    const heading = content?.[0];
    expect(heading?.props.layerName).toBe("Intro");
    expect(session.history.entries().at(-1)?.label).toBe("Renamed Heading to 'Intro'");
  });

  it("gives the focus back to the canvas when the menu closes (#223 review)", async () => {
    const { engine } = setUp();
    const canvas = document.createElement("button");
    document.body.append(canvas);
    canvas.focus();

    act(() => engine.rightClick({ nodeId: "heading-1", x: 0, y: 0 }));
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(document.activeElement).toBe(canvas));
    canvas.remove();
  });

  it("has no Rename for an element of the shared Header, which Layers doesn't list", () => {
    const { engine } = setUp();

    act(() => engine.rightClick({ nodeId: "header", x: 0, y: 0 }));

    expect(items()[0]).toEqual(["Rename", true]);
  });
});
