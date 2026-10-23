import type { NodeDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it, vi } from "vitest";
import { createCommandRegistry } from "../shell/commands.js";
import { createEditorSession, currentPage } from "./editor-session.js";
import { registerElementCommands } from "./element-commands.js";
import { createFakeEngine } from "./fake-engine.test-helper.js";
import { starterSite } from "./starter-site.js";

/** A page with a Section holding a Heading, the Heading selected, and the commands registered. */
function setUp() {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  const content: NodeDoc[] = [
    {
      type: "Section",
      props: { id: "s1", content: [{ type: "Heading", props: { id: "a", text: "Hello" } }] },
    },
  ];
  const session = createEditorSession(siteLibrary, {
    ...site,
    pages: { ...site.pages, [home.id]: { ...home, doc: { root: { props: {} }, content } } },
  });
  session.ui.setState({ nodeId: "a" });
  const registry = createCommandRegistry();
  const engine = createFakeEngine();
  const beforeAction = vi.fn();
  const pickImage = vi.fn();
  const commands = registerElementCommands(registry, session, engine, beforeAction, pickImage);
  commands.setHasSelection(true);
  const hidden = () =>
    (currentPage(session)?.doc.content[0]?.props.content as NodeDoc[] | undefined)?.[0]?.props
      .hidden;
  const labels = () => session.history.entries().map((entry) => entry.label);
  return { session, registry, engine, beforeAction, pickImage, commands, hidden, labels };
}

describe("registerElementCommands (1.30, F-ED-25, F-ED-27)", () => {
  it("hides the selected element with Mod + /, and shows it again, as Layers' steps", () => {
    const { registry, beforeAction, hidden, labels } = setUp();

    expect(registry.get("edit.toggleHidden")).toMatchObject({
      shortcut: "Mod+/",
      menu: "edit",
      textShortcut: true,
      label: "Hide or show",
    });
    registry.run("edit.toggleHidden");
    expect(hidden()).toBe(true);
    registry.run("edit.toggleHidden");

    expect(hidden()).toBeUndefined();
    expect(labels()).toEqual(["Hid Heading", "Showed Heading"]);
    expect(beforeAction).toHaveBeenCalledTimes(2);
  });

  it("does what the chip asks: hides or shows, or opens the image picker", () => {
    const { engine, pickImage, hidden, labels } = setUp();

    engine.requestFromElement({ kind: "toggleHidden", nodeId: "a" });
    engine.requestFromElement({ kind: "pickImage", nodeId: "a" });

    expect(hidden()).toBe(true);
    expect(labels()).toEqual(["Hid Heading"]);
    expect(pickImage).toHaveBeenCalledExactlyOnceWith("a");
  });

  it("hides nothing while nothing is selected or Content mode locks the layout (M3)", () => {
    const { registry, engine, pickImage, commands, hidden } = setUp();

    commands.setLayoutLocked(true);
    expect(registry.get("edit.toggleHidden")?.enabled).toBe(false);
    engine.requestFromElement({ kind: "toggleHidden", nodeId: "a" });
    // Editing an image changes no layout.
    engine.requestFromElement({ kind: "pickImage", nodeId: "a" });
    commands.setLayoutLocked(false);
    commands.setHasSelection(false);

    expect(registry.get("edit.toggleHidden")?.enabled).toBe(false);
    expect(hidden()).toBeUndefined();
    expect(pickImage).toHaveBeenCalledOnce();
  });

  it("removes the command and stops listening to the chip", () => {
    const { registry, engine, commands, hidden } = setUp();

    commands.remove();
    engine.requestFromElement({ kind: "toggleHidden", nodeId: "a" });

    expect(registry.get("edit.toggleHidden")).toBeUndefined();
    expect(hidden()).toBeUndefined();
  });
});
