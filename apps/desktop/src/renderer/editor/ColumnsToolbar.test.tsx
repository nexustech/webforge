// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@webforge/editor-ui";
import type { NodeDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasToolbarHost } from "../shell/CanvasToolbarHost.js";
import { createCanvasView } from "../shell/canvas-view.js";
import { ContextualToolbarsProvider } from "../shell/contextual-toolbar-context.js";
import { createContextualToolbars } from "../shell/contextual-toolbars.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { columnsToolbar } from "./ColumnsToolbar.js";
import { createPreviewStore } from "./edit-previews.js";
import { createEditorSession, currentPage } from "./editor-session.js";
import { starterSite } from "./starter-site.js";

afterEach(cleanup);

const text = (id: string): NodeDoc => ({ type: "Text", props: { id, text: `<p>${id}</p>` } });
const column = (id: string): NodeDoc => ({
  type: "Column",
  props: { id, content: [text(`${id}-text`)] },
});

/** The starter page with a two-column Columns in its Section, and the Columns toolbar. */
function setUp(mode: "design" | "content" = "design") {
  const site = starterSite();
  const section = site.pages[site.homePageId]?.doc.content[0];
  if (section === undefined) throw new Error("no section");
  (section.props.content as NodeDoc[]).push({
    type: "Columns",
    props: {
      id: "columns",
      columns: [column("left"), column("right")],
      layout: { $responsive: { desktop: "equal", mobile: "stacked" } },
    },
  });
  const session = createEditorSession(siteLibrary, site);
  const flush = vi.fn();
  const previews = createPreviewStore();
  const toolbars = createContextualToolbars();
  toolbars.register(columnsToolbar({ session, flush, previews }));
  const preferences = createPreferencesStore();
  preferences.changeMode(mode);
  render(
    <TooltipProvider>
      <ContextualToolbarsProvider registry={toolbars}>
        <CanvasToolbarHost session={session} view={createCanvasView()} preferences={preferences} />
      </ContextualToolbarsProvider>
    </TooltipProvider>,
  );
  const columnsNode = () =>
    (currentPage(session)?.doc.content[0]?.props.content as NodeDoc[] | undefined)?.find(
      (node) => node.type === "Columns",
    );
  const columns = () => (columnsNode()?.props.columns as NodeDoc[] | undefined) ?? [];
  const labels = () => session.history.entries().map((entry) => entry.label);
  return { session, flush, previews, columnsNode, columns, labels };
}

const button = (name: string) => screen.getByRole("button", { name });
const layoutChoice = (name: string) => screen.getByRole("radio", { name });

describe("the Columns toolbar (2.17, SP-4)", () => {
  it("shows for the Columns and for one of its columns, in Design mode only", () => {
    const { session } = setUp();

    act(() => session.select("right"));
    expect(screen.getByRole("group", { name: "Columns" })).toBeTruthy();
    act(() => session.select("columns"));
    expect(screen.getByRole("radiogroup", { name: "Column widths on Desktop" })).toBeTruthy();
  });

  it("is not offered in Content mode, which locks the design (R9)", () => {
    const { session } = setUp("content");

    act(() => session.select("columns"));

    expect(screen.queryByRole("group", { name: "Columns" })).toBeNull();
  });

  it("adds a column with a Text, its own ids, as one step that selects it", async () => {
    const { session, flush, columns, labels } = setUp();
    act(() => session.select("left"));

    await userEvent.click(button("Add column"));

    expect(flush).toHaveBeenCalled();
    expect(labels()).toEqual(["Added Column"]);
    const added = columns()[2];
    const [inside] = (added?.props.content as NodeDoc[] | undefined) ?? [];
    expect(added?.type).toBe("Column");
    expect(inside?.type).toBe("Text");
    // Ids of their own, not the defaults' or another column's.
    const ids = columns().flatMap((each) => [
      each.props.id,
      ...((each.props.content as NodeDoc[]).map((node) => node.props.id) ?? []),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(session.ui.getState().nodeId).toBe(added?.props.id);
  });

  it("removes the last column with what's in it, as one step, never below one", async () => {
    const { session, columns, labels } = setUp();
    act(() => session.select("right"));

    await userEvent.click(button("Remove last column"));

    expect(columns().map((each) => each.props.id)).toEqual(["left"]);
    expect(labels()).toEqual(["Deleted Column"]);
    // The column selected went: the Columns is selected instead.
    expect(session.ui.getState().nodeId).toBe("columns");
    expect(button("Remove last column")).toHaveProperty("disabled", true);
  });

  it("adds columns up to four, and offers the widths that fit how many there are", async () => {
    const { session } = setUp();
    act(() => session.select("columns"));
    const choices = () =>
      within(screen.getByRole("radiogroup", { name: "Column widths on Desktop" }))
        .getAllByRole("radio")
        .map((each) => each.getAttribute("aria-label"));

    expect(choices()).toEqual(["Equal", "First one wider", "Last one wider", "One under another"]);
    await userEvent.click(button("Add column"));
    act(() => session.select("columns"));
    expect(choices()).toEqual([
      "Equal",
      "First one wider",
      "Middle one wider",
      "Last one wider",
      "One under another",
    ]);
    await userEvent.click(button("Add column"));
    act(() => session.select("columns"));

    expect(choices()).toEqual(["Equal", "One under another"]);
    expect(button("Add column")).toHaveProperty("disabled", true);
  });

  it("sets the widths for the device shown only, as one step named as the Edit panel names it", async () => {
    const { session, columnsNode, labels } = setUp();
    act(() => session.select("columns"));
    expect(layoutChoice("Equal").getAttribute("aria-checked")).toBe("true");

    await userEvent.click(layoutChoice("First one wider"));
    act(() => session.setViewport("mobile"));

    expect(columnsNode()?.props.layout).toEqual({
      $responsive: { desktop: "wideFirst", mobile: "stacked" },
    });
    expect(labels()).toHaveLength(1);
    // On Mobile, the column widths are Mobile's own: one under another.
    expect(screen.getByRole("radiogroup", { name: "Column widths on Mobile" })).toBeTruthy();
    expect(layoutChoice("One under another").getAttribute("aria-checked")).toBe("true");
  });

  it("turns column outlines off and on without an undo step (U6)", async () => {
    const { session, previews, labels } = setUp();
    act(() => session.select("columns"));
    const toggle = () => button("Show column outlines");
    expect(toggle().getAttribute("aria-pressed")).toBe("true");

    await userEvent.click(toggle());
    expect(previews.getState().columnOutlines).toBe(false);
    await userEvent.click(toggle());

    expect(previews.getState().columnOutlines).toBe(true);
    expect(labels()).toEqual([]);
  });
});
