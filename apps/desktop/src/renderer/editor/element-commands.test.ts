import {
  copiedNodeId,
  type NodeDoc,
  SHARED_COPY_TYPE,
  type SharedSectionId,
} from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it, vi } from "vitest";
import { createCommandRegistry } from "../shell/commands.js";
import { createEditorSession, currentPage } from "./editor-session.js";
import { registerElementCommands } from "./element-commands.js";
import { createFakeEngine } from "./fake-engine.test-helper.js";
import { starterSite } from "./starter-site.js";

const HOURS = "shared-hours" as SharedSectionId;

/**
 * A page with a Section holding a Heading, and a linked copy of "Opening hours"; the Heading
 * selected, and the commands registered.
 */
function setUp() {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  const content: NodeDoc[] = [
    {
      type: "Section",
      props: { id: "s1", content: [{ type: "Heading", props: { id: "a", text: "Hello" } }] },
    },
    { type: SHARED_COPY_TYPE, props: { id: "c1", sharedSectionId: HOURS } },
  ];
  const session = createEditorSession(siteLibrary, {
    ...site,
    pages: { ...site.pages, [home.id]: { ...home, doc: { root: { props: {} }, content } } },
    sharedSections: {
      [HOURS]: {
        id: HOURS,
        name: "Opening hours",
        section: {
          type: "Section",
          props: { id: "s", content: [{ type: "Heading", props: { id: "t", text: "Hours" } }] },
        },
      },
    },
  });
  session.select("a");
  const registry = createCommandRegistry();
  const engine = createFakeEngine();
  const beforeAction = vi.fn();
  const pickImage = vi.fn();
  const commands = registerElementCommands(registry, session, engine, beforeAction, pickImage);
  const hidden = () =>
    (currentPage(session)?.doc.content[0]?.props.content as NodeDoc[] | undefined)?.[0]?.props
      .hidden;
  const enabled = () => registry.get("edit.toggleHidden")?.enabled;
  const labels = () => session.history.entries().map((entry) => entry.label);
  return { session, registry, engine, beforeAction, pickImage, commands, hidden, enabled, labels };
}

describe("registerElementCommands (1.30, F-ED-25, F-ED-27)", () => {
  it("hides the selected element with Mod + /, and shows it again, as Layers' steps", () => {
    const { registry, beforeAction, hidden, labels } = setUp();

    expect(registry.get("edit.toggleHidden")).toMatchObject({
      shortcut: "Mod+/",
      menu: "edit",
      textShortcut: true,
      enabled: true,
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

  it("hides only a layer: a linked copy as a whole, not what is inside it or the Header", () => {
    const { session, engine, enabled, labels } = setUp();
    const copy = copiedNodeId("c1", "s");

    session.select(copy);
    expect(enabled()).toBe(true);
    // An element of the copy's shared section, and one of the shared Header.
    for (const id of [copiedNodeId("c1", "t"), "header-logo"]) {
      session.select(id);
      expect(enabled()).toBe(false);
      engine.requestFromElement({ kind: "toggleHidden", nodeId: id });
    }
    session.select(null);
    expect(enabled()).toBe(false);

    expect(labels()).toEqual([]);
  });

  it("hides nothing while Content mode locks the layout (M3), but still edits images", () => {
    const { registry, engine, pickImage, commands, enabled, hidden } = setUp();

    commands.setLayoutLocked(true);
    expect(enabled()).toBe(false);
    registry.run("edit.toggleHidden");
    engine.requestFromElement({ kind: "toggleHidden", nodeId: "a" });
    engine.requestFromElement({ kind: "pickImage", nodeId: "a" });
    commands.setLayoutLocked(false);

    expect(enabled()).toBe(true);
    expect(hidden()).toBeUndefined();
    expect(pickImage).toHaveBeenCalledOnce();
  });

  it("removes the command and stops following the chip and the selection", () => {
    const { session, registry, engine, commands, hidden } = setUp();

    commands.remove();
    engine.requestFromElement({ kind: "toggleHidden", nodeId: "a" });
    session.select(null);

    expect(registry.get("edit.toggleHidden")).toBeUndefined();
    expect(hidden()).toBeUndefined();
  });
});
