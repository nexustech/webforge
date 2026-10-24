// @vitest-environment happy-dom
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
  const rename = vi.fn();
  const notify = vi.fn();
  const commands = registerElementCommands(
    registry,
    session,
    engine,
    beforeAction,
    pickImage,
    rename,
    notify,
  );
  const hidden = () =>
    (currentPage(session)?.doc.content[0]?.props.content as NodeDoc[] | undefined)?.[0]?.props
      .hidden;
  const enabled = () => registry.get("edit.toggleHidden")?.enabled;
  const labels = () => session.history.entries().map((entry) => entry.label);
  return {
    session,
    registry,
    engine,
    beforeAction,
    pickImage,
    rename,
    notify,
    commands,
    hidden,
    enabled,
    labels,
  };
}

describe("registerElementCommands (1.30, F-ED-25, F-ED-27)", () => {
  it("hides the selected element with Mod + /, and shows it again, as Layers' steps", () => {
    const { registry, beforeAction, hidden, labels } = setUp();

    expect(registry.get("edit.toggleHidden")).toMatchObject({
      shortcut: "Mod+/",
      menu: "edit",
      textKeys: ["Mod+/"],
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

  it("hides several selected elements together as one step, or says why not (1.31)", () => {
    const { session, registry, engine, notify, hidden, labels } = setUp();
    const copy = () => currentPage(session)?.doc.content[1]?.props.hidden;

    session.selectElements(["a", copiedNodeId("c1", "s")]);
    expect(registry.get("edit.toggleHidden")?.enabled).toBe(true);
    registry.run("edit.toggleHidden");
    expect([hidden(), copy()]).toEqual([true, true]);
    // The chip names one element while several are selected: its request hides that one only.
    engine.requestFromElement({ kind: "toggleHidden", nodeId: copiedNodeId("c1", "t") });

    // With an element of a linked copy among them: nothing, and the reason.
    session.selectElements(["a", copiedNodeId("c1", "t")]);
    registry.run("edit.toggleHidden");
    expect(notify).toHaveBeenCalledExactlyOnceWith(
      "Elements of the shared Header or Footer, or of a shared section, are changed one at a time.",
    );
    expect(labels()).toEqual(["Hid 2 elements"]);
  });

  it("asks for a layer's name with F2, in Content mode too; nothing else has one (1.30)", () => {
    const { session, registry, rename, commands } = setUp();
    const renameEnabled = () => registry.get("edit.rename")?.enabled;

    expect(registry.get("edit.rename")).toMatchObject({ shortcut: "F2", menu: "edit" });
    commands.setLayoutLocked(true);
    expect(renameEnabled()).toBe(true);
    registry.run("edit.rename");
    expect(rename).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: "a" }));

    for (const id of [copiedNodeId("c1", "t"), "header-logo", null]) {
      session.select(id);
      expect(renameEnabled()).toBe(false);
    }
    session.select(copiedNodeId("c1", "s"));
    expect(renameEnabled()).toBe(true);
  });

  it("selects every element like the selected one, in Content mode too, and never the Header (1.35)", () => {
    const { session, registry, commands } = setUp();
    session.edit("insert", "Added Heading", (draft) => {
      const section = draft.pages[draft.homePageId]?.doc.content[0];
      (section?.props.content as NodeDoc[] | undefined)?.push({
        type: "Heading",
        props: { id: "b", text: "Again" },
      });
    });
    const enabled = () => registry.get("edit.selectSimilar")?.enabled;

    expect(registry.get("edit.selectSimilar")).toMatchObject({
      label: "Select similar",
      menu: "edit",
    });
    // Selecting changes no layout (M3).
    commands.setLayoutLocked(true);
    expect(enabled()).toBe(true);
    registry.run("edit.selectSimilar");
    expect(session.ui.getState()).toMatchObject({ nodeId: "a", others: ["b"] });
    // No undo step: the selection is the editor's (U6).
    expect(session.history.entries().map((entry) => entry.label)).toEqual(["Added Heading"]);

    for (const id of [copiedNodeId("c1", "t"), "header-logo", null]) {
      session.select(id);
      expect(enabled()).toBe(false);
    }
  });

  it("splits text in two at the caret as one step, the second half selected (Alt+Enter, F-ED-27)", async () => {
    const { session, engine, beforeAction, labels } = setUp();
    const section = () => currentPage(session)?.doc.content[0]?.props.content as NodeDoc[];

    engine.splitText({ nodeId: "a", field: "text", before: "Hel", after: "lo" });

    const [first, second] = section();
    expect(beforeAction).toHaveBeenCalledOnce();
    expect(first?.props).toMatchObject({ id: "a", text: "Hel" });
    expect(second?.type).toBe("Heading");
    expect(second?.props.text).toBe("lo");
    expect(second?.props.id).not.toBe("a");
    expect(session.ui.getState().nodeId).toBe(second?.props.id);
    expect(labels()).toEqual(["Split Heading"]);
    // The second half is edited on.
    await vi.waitFor(() => expect(engine.perform).toHaveBeenCalledWith("editText"));
    session.history.undo();
    expect(section().map((node) => node.props.text)).toEqual(["Hello"]);
    expect(session.ui.getState().nodeId).toBe("a");
  });

  it("gives the second half its component's default for its other texts (a new FAQ question)", () => {
    const { session, engine } = setUp();
    session.history.run("Set up", (draft) => {
      const content = draft.pages[draft.homePageId]?.doc.content[0]?.props.content as NodeDoc[];
      content.push({
        type: "FaqItem",
        props: { id: "q1", question: "When are you open?", answer: "<p>Daily. Not Sundays.</p>" },
      });
    });
    session.select("q1");

    engine.splitText({
      nodeId: "q1",
      field: "answer",
      before: "<p>Daily.</p>",
      after: "<p>Not Sundays.</p>",
    });

    const items = ((currentPage(session)?.doc.content[0]?.props.content ?? []) as NodeDoc[]).slice(
      1,
    );
    expect(items.map((item) => [item.props.question, item.props.answer])).toEqual([
      ["When are you open?", "<p>Daily.</p>"],
      [siteLibrary.components.FaqItem?.defaults.question, "<p>Not Sundays.</p>"],
    ]);
  });

  it("splits only the page's own text, and nothing in Content mode, saying why (F-ED-27)", () => {
    const { session, engine, commands, notify, labels } = setUp();

    // Inside the linked copy: every page showing it would change.
    engine.splitText({
      nodeId: copiedNodeId("c1", "t"),
      field: "text",
      before: "H",
      after: "ours",
    });
    commands.setLayoutLocked(true);
    engine.splitText({ nodeId: "a", field: "text", before: "Hel", after: "lo" });

    expect(notify.mock.calls).toEqual([
      [
        "Only the page's own text can be split. The shared Header and Footer, and shared sections, are shown on other pages too.",
      ],
      ["Splitting text adds an element. Switch to Design mode to split it."],
    ]);
    expect(labels()).toEqual([]);
    expect(session.ui.getState().nodeId).toBe("a");
  });

  it("removes the command and stops following the chip and the selection", () => {
    const { session, registry, engine, commands, hidden } = setUp();

    commands.remove();
    engine.requestFromElement({ kind: "toggleHidden", nodeId: "a" });
    session.select(null);

    expect(registry.get("edit.toggleHidden")).toBeUndefined();
    expect(registry.get("edit.rename")).toBeUndefined();
    expect(hidden()).toBeUndefined();
  });
});
