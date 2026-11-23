// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@webforge/editor-ui";
import type { NodeDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { CanvasToolbarHost } from "../shell/CanvasToolbarHost.js";
import { createCanvasView } from "../shell/canvas-view.js";
import { ContextualToolbarsProvider } from "../shell/contextual-toolbar-context.js";
import { createContextualToolbars } from "../shell/contextual-toolbars.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { createEditorSession } from "./editor-session.js";
import { footerToolbar } from "./FooterToolbar.js";

afterEach(cleanup);

/** The starter site with `columns` in its Footer, the Footer selected and its toolbar shown. */
function setUp(columns: NodeDoc[] = []) {
  const site = starterSite();
  const footer = site.layout.footer.find((node) => node.type === "Footer");
  if (footer === undefined) throw new Error("no Footer");
  footer.props.columns = columns;
  const session = createEditorSession(siteLibrary, site);
  const toolbars = createContextualToolbars();
  toolbars.register(footerToolbar({ session, flush: vi.fn() }));
  const preferences = createPreferencesStore();
  preferences.changeMode("design");
  render(
    <TooltipProvider>
      <ContextualToolbarsProvider registry={toolbars}>
        <CanvasToolbarHost session={session} view={createCanvasView()} preferences={preferences} />
      </ContextualToolbarsProvider>
    </TooltipProvider>,
  );
  act(() => session.select(String(footer.props.id)));
  const footerNode = () =>
    session.history.document.getState().layout.footer.find((node) => node.type === "Footer");
  const shown = () => (footerNode()?.props.columns as NodeDoc[] | undefined) ?? [];
  const typesIn = (column: NodeDoc | undefined) =>
    ((column?.props.content ?? []) as NodeDoc[]).map((node) => node.type);
  const labels = () => session.history.entries().map((entry) => entry.label);
  return {
    session,
    footerId: String(footer.props.id),
    footerNode,
    shown,
    typesIn,
    labels,
    user: userEvent.setup({ delay: null }),
  };
}

const startFrom = () => screen.getByRole("group", { name: "Start from" });

describe("the Footer's toolbar (HF-4, 5.39)", () => {
  it("starts the Footer from Full, its columns' elements with their defaults, in one step", async () => {
    const { session, footerId, footerNode, shown, typesIn, labels, user } = setUp();
    const text = footerNode()?.props.text;

    await user.click(within(startFrom()).getByRole("button", { name: "Full" }));

    expect(footerNode()?.props.variant).toBe("columns");
    expect(shown().map(typesIn)).toEqual([
      ["Heading", "MenuLinks"],
      ["ContactDetails"],
      ["SocialLinks", "Newsletter"],
    ]);
    // Each element has its defaults and an id of its own; the Footer keeps its text.
    const [contact] = (shown()[1]?.props.content ?? []) as NodeDoc[];
    expect(contact?.props).toMatchObject(siteLibrary.components.ContactDetails?.defaults ?? {});
    expect(contact?.props.id).not.toBe("footer-contact-details");
    expect(footerNode()?.props.text).toBe(text);
    expect(labels()).toEqual(["Started the Footer from 'Full'"]);
    expect(session.ui.getState().nodeId).toBe(footerId);

    session.history.undo();
    expect(shown()).toEqual([]);
  });

  it("replaces the elements in the columns at once, with an Undo toast, never a question (LF-15)", async () => {
    const { session, shown, typesIn, footerNode, labels, user } = setUp([
      {
        type: "FooterColumn",
        props: { id: "col", content: [{ type: "Text", props: { id: "t", text: "<p>Hi</p>" } }] },
      },
    ]);
    const announced: (boolean | string)[] = [];
    session.onEntryAdded((_entry, _kind, announce) => announced.push(announce));

    await user.click(within(startFrom()).getByRole("button", { name: "Simple" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(shown()).toEqual([]);
    expect(footerNode()?.props.variant).toBe("centred");
    expect(labels()).toEqual(["Started the Footer from 'Simple'"]);
    expect(announced).toEqual(["Started the Footer from 'Simple' on every page"]);

    session.history.undo();
    expect(shown().map(typesIn)).toEqual([["Text"]]);
  });

  it("shows no toast when the columns held nothing to replace", async () => {
    const { session, user } = setUp();
    const announced: (boolean | string)[] = [];
    session.onEntryAdded((_entry, _kind, announce) => announced.push(announce));
    await user.click(within(startFrom()).getByRole("button", { name: "Columns" }));
    expect(announced).toEqual([false]);
  });

  it("adds columns up to three and removes the last, each a step of its own", async () => {
    const { session, footerId, shown, labels, user } = setUp();
    // Each new column is selected, and the toolbar shows for it too: found again each time.
    const add = () => screen.getByRole("button", { name: "Add column" });
    const remove = screen.getByRole("button", { name: "Remove last column" });
    expect((remove as HTMLButtonElement).disabled).toBe(true);

    for (let n = 0; n < 3; n++) await user.click(add());
    expect(shown().map((column) => column.type)).toEqual([
      "FooterColumn",
      "FooterColumn",
      "FooterColumn",
    ]);
    expect((screen.getByRole("button", { name: "Add column" }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    // The last column, just added, is selected: removing it selects the Footer.
    expect(session.ui.getState().nodeId).toBe(String(shown()[2]?.props.id));
    await user.click(screen.getByRole("button", { name: "Remove last column" }));
    expect(shown()).toHaveLength(2);
    expect(session.ui.getState().nodeId).toBe(footerId);
    expect(labels()).toHaveLength(4);
    expect(labels()[0]).toBe("Added shared Footer column");
  });
});
