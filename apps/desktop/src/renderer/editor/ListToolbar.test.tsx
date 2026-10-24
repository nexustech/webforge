// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { copiedNodeId, type NodeDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveAsSharedSection } from "../shared-sections/shared-sections.js";
import { CanvasToolbarHost } from "../shell/CanvasToolbarHost.js";
import { createCanvasView } from "../shell/canvas-view.js";
import { ContextualToolbarsProvider } from "../shell/contextual-toolbar-context.js";
import { createContextualToolbars } from "../shell/contextual-toolbars.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { createEditorSession, currentPage } from "./editor-session.js";
import { listToolbar } from "./ListToolbar.js";
import { starterSite } from "./starter-site.js";

afterEach(cleanup);

const item = (id: string, text: string): NodeDoc => ({ type: "ListItem", props: { id, text } });
const list = (): NodeDoc => ({
  type: "List",
  props: { id: "list", items: [item("bread", "Bread"), item("cakes", "Cakes")] },
});

/** The starter page with a List in its Section, and the canvas toolbar with the List toolbar. */
function setUp(mode: "design" | "content" = "design") {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  const section = home?.doc.content[0];
  if (section === undefined) throw new Error("no section");
  (section.props.content as NodeDoc[]).push(list());
  const session = createEditorSession(siteLibrary, site);
  const flush = vi.fn();
  const toolbars = createContextualToolbars();
  toolbars.register(listToolbar({ session, flush }));
  const preferences = createPreferencesStore();
  preferences.changeMode(mode);
  render(
    <ContextualToolbarsProvider registry={toolbars}>
      <CanvasToolbarHost session={session} view={createCanvasView()} preferences={preferences} />
    </ContextualToolbarsProvider>,
  );
  const texts = (node: NodeDoc | undefined) =>
    (node?.props.items as NodeDoc[] | undefined)?.map((each) => each.props.text);
  const items = () => {
    const content = currentPage(session)?.doc.content[0]?.props.content as NodeDoc[] | undefined;
    return texts(content?.find((node) => node.type === "List"));
  };
  const labels = () => session.history.entries().map((entry) => entry.label);
  return { session, flush, items, texts, labels };
}

const button = (name: string) => screen.getByRole("button", { name });

describe("the List toolbar (SP-4)", () => {
  it("adds an item after or before the selected one, as one step that selects it", async () => {
    const { session, flush, items, labels } = setUp();
    act(() => session.select("bread"));

    await userEvent.click(button("Add item after"));
    expect(items()).toEqual(["Bread", "List item", "Cakes"]);
    const added = session.ui.getState().nodeId;
    expect(added).not.toBe("bread");

    await userEvent.click(button("Add item before"));
    expect(items()).toEqual(["Bread", "List item", "List item", "Cakes"]);
    expect(session.ui.getState().nodeId).not.toBe(added);

    expect(flush).toHaveBeenCalled();
    expect(labels()).toEqual(["Added List item", "Added List item"]);
    act(() => {
      session.history.undo();
    });
    expect(items()).toEqual(["Bread", "List item", "Cakes"]);
  });

  it("adds at the end of a selected List, which has no item to put one before or after", async () => {
    const { session, items } = setUp();
    act(() => session.select("list"));

    expect(button("Add item before")).toHaveProperty("disabled", true);
    expect(button("Add item after")).toHaveProperty("disabled", true);
    await userEvent.click(button("Add item at the end"));

    expect(items()).toEqual(["Bread", "Cakes", "List item"]);
  });

  it("shows in Content mode too: adding items changes what the page says", () => {
    const { session } = setUp("content");
    act(() => session.select("cakes"));

    expect(button("Add item at the end")).toBeTruthy();
  });

  it("adds to the shared section of a linked copy, selecting the item as the copy shows it", async () => {
    const { session, texts } = setUp();
    act(() => session.select("section-1"));
    act(() => {
      saveAsSharedSection(session, "Our bakes");
    });
    const [shared] = Object.values(session.history.document.getState().sharedSections);
    const copyId = currentPage(session)?.doc.content[0]?.props.id ?? "";
    act(() => session.select(copiedNodeId(copyId, "cakes")));

    await userEvent.click(button("Add item after"));

    const section = shared && session.history.document.getState().sharedSections[shared.id];
    const sharedList = (section?.section.props.content as NodeDoc[] | undefined)?.find(
      (node) => node.type === "List",
    );
    expect(texts(sharedList)).toEqual(["Bread", "Cakes", "List item"]);
    // The new item, as the copy shows it.
    const added = sharedList === undefined ? undefined : (sharedList.props.items as NodeDoc[])[2];
    expect(session.ui.getState().nodeId).toBe(copiedNodeId(copyId, added?.props.id ?? ""));
  });
});
