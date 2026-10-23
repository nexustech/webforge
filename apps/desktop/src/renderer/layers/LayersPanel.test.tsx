// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dropIndex,
  LayersPanel,
  type LayersPanelActions,
  type LayersPanelProps,
} from "./LayersPanel.js";
import type { Layer } from "./layers.js";

afterEach(cleanup);

const layer = (id: string, extra: Partial<Layer> = {}): Layer => ({
  id,
  kind: "Heading",
  name: undefined,
  hidden: false,
  children: [],
  ...extra,
});

const LAYERS: Layer[] = [
  layer("s1", {
    kind: "Section",
    children: [layer("a"), layer("b", { name: "Hours" }), layer("c", { hidden: true })],
  }),
  layer("s2", { kind: "Section" }),
];

function setUp(
  selectedId: string | null = "a",
  toolbar = true,
  layoutLocked = false,
  alsoSelected: readonly string[] = [],
) {
  const command = () => (toolbar ? vi.fn() : undefined);
  const actions = {
    select: vi.fn(),
    toggle: vi.fn(),
    selectMany: vi.fn(),
    rename: vi.fn(),
    setHidden: vi.fn(),
    move: vi.fn(),
    moveUp: command(),
    moveDown: command(),
    duplicate: command(),
    remove: command(),
  } satisfies LayersPanelActions;
  const menu = vi.fn((_: Parameters<NonNullable<LayersPanelProps["menu"]>>[0]) => null);
  render(
    <LayersPanel
      layers={LAYERS}
      selectedId={selectedId}
      alsoSelected={alsoSelected}
      actions={actions}
      layoutLocked={layoutLocked}
      menu={menu}
    />,
  );
  const item = (name: RegExp) => screen.getByRole("treeitem", { name });
  /** What the menu was last drawn with. */
  const lastMenu = () => menu.mock.calls.at(-1)?.[0];
  return { actions, item, lastMenu };
}

/** The rows shown, as their text. */
const shown = () => screen.queryAllByRole("treeitem").map((row) => row.textContent);

describe("LayersPanel (F-ED-12)", () => {
  it("shows the tree with levels, names, the selection and hidden layers", () => {
    const { item } = setUp();

    const items = screen.getAllByRole("treeitem");
    expect(items.map((row) => [row.textContent, row.getAttribute("aria-level")])).toEqual([
      ["Section", "1"],
      ["Heading", "2"],
      ["Hours Heading", "2"],
      ["Heading", "2"],
      ["Section", "1"],
    ]);
    expect(item(/^Hours/).getAttribute("aria-posinset")).toBe("2");
    expect(items[1]?.getAttribute("aria-selected")).toBe("true");
    expect(items[1]?.tabIndex).toBe(0);
    expect(items[0]?.tabIndex).toBe(-1);
    expect(screen.getByRole("button", { name: "Show Heading" })).toBeTruthy();
  });

  it("locks dragging, moving and hiding in Content mode, keeping selection and names (M3)", async () => {
    const { actions } = setUp("a", false, true);
    const rows = screen.getAllByRole("treeitem");

    expect(rows.every((row) => row.getAttribute("draggable") === "false")).toBe(true);
    fireEvent.keyDown(rows[1] as HTMLElement, { key: "ArrowDown", altKey: true });
    for (const hide of screen.getAllByRole("button", { name: /^Hide/, hidden: true })) {
      fireEvent.click(hide);
    }
    fireEvent.keyDown(rows[1] as HTMLElement, { key: "ArrowDown" });

    expect(actions.move).not.toHaveBeenCalled();
    expect(actions.setHidden).not.toHaveBeenCalled();
    expect(actions.select).toHaveBeenCalled();
  });

  it("selects on click and with the arrow keys; Alt+arrows move among siblings", async () => {
    const { actions } = setUp();
    const rows = screen.getAllByRole("treeitem");

    await userEvent.click(rows[4] as HTMLElement);
    fireEvent.keyDown(rows[1] as HTMLElement, { key: "ArrowDown" });
    fireEvent.keyDown(rows[1] as HTMLElement, { key: "ArrowUp" });
    fireEvent.keyDown(rows[0] as HTMLElement, { key: "ArrowUp" });
    fireEvent.keyDown(rows[1] as HTMLElement, { key: "ArrowDown", altKey: true });
    fireEvent.keyDown(rows[2] as HTMLElement, { key: "ArrowUp", altKey: true });
    fireEvent.keyDown(rows[1] as HTMLElement, { key: "Delete" });
    expect(actions.remove).toHaveBeenCalledOnce();

    expect(actions.select.mock.calls).toEqual([["s2"], ["b"], ["s1"]]);
    expect(actions.move.mock.calls).toEqual([
      ["a", 1],
      ["b", 0],
    ]);
  });

  it("selects several: Ctrl/Cmd-click adds or takes away, Shift-click a range (1.31)", async () => {
    const { actions } = setUp("a", true, false, ["s2"]);
    const rows = screen.getAllByRole("treeitem");

    expect(screen.getByRole("tree").getAttribute("aria-multiselectable")).toBe("true");
    expect(rows.map((row) => row.getAttribute("aria-selected"))).toEqual([
      "false",
      "true",
      "false",
      "false",
      "true",
    ]);
    fireEvent.click(rows[2] as HTMLElement, { ctrlKey: true });
    fireEvent.click(rows[2] as HTMLElement, { metaKey: true });
    // From the last row clicked without Shift (b) to c, as listed: the clicked one shown.
    fireEvent.click(rows[3] as HTMLElement, { shiftKey: true });

    expect(actions.toggle.mock.calls).toEqual([["b"], ["b"]]);
    expect(actions.selectMany.mock.calls).toEqual([[["c", "b"]]]);
    expect(actions.select).not.toHaveBeenCalled();
  });

  it("moves all selected layers with Alt+arrows, as the Edit menu does (1.31)", () => {
    const { actions } = setUp("a", true, false, ["b"]);
    const rows = screen.getAllByRole("treeitem");

    fireEvent.keyDown(rows[1] as HTMLElement, { key: "ArrowDown", altKey: true });
    fireEvent.keyDown(rows[1] as HTMLElement, { key: "ArrowUp", altKey: true });

    expect(actions.moveDown).toHaveBeenCalledOnce();
    expect(actions.moveUp).toHaveBeenCalledOnce();
    expect(actions.move).not.toHaveBeenCalled();
  });

  it("keeps a Shift-click range's start on the last row clicked without Shift (#259 review)", () => {
    const { actions } = setUp("s2");
    const rows = screen.getAllByRole("treeitem");

    fireEvent.click(rows[1] as HTMLElement);
    fireEvent.click(rows[3] as HTMLElement, { shiftKey: true });
    // From a again, not from c: the start stays where it was.
    fireEvent.click(rows[2] as HTMLElement, { shiftKey: true });
    fireEvent.click(rows[4] as HTMLElement, { ctrlKey: true });
    fireEvent.click(rows[3] as HTMLElement, { shiftKey: true });

    expect(actions.selectMany.mock.calls).toEqual([[["c", "a", "b"]], [["b", "a"]], [["c", "s2"]]]);
  });

  it("renames with F2 or a double-click; Enter keeps the name, Escape cancels", async () => {
    const { actions, item } = setUp();

    fireEvent.keyDown(screen.getAllByRole("treeitem")[1] as HTMLElement, { key: "F2" });
    const field = screen.getByRole("textbox", { name: "Name for this Heading" });
    await userEvent.type(field, "Opening times{Enter}");
    await userEvent.dblClick(item(/^Hours/));
    await userEvent.type(screen.getByRole("textbox"), "{Escape}");
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(actions.rename.mock.calls).toEqual([["a", "Opening times"]]);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("hides and shows layers with the eye, without selecting them", async () => {
    const { actions } = setUp();

    await userEvent.click(screen.getByRole("button", { name: "Hide 'Hours'" }));
    await userEvent.click(screen.getByRole("button", { name: "Show Heading" }));

    expect(actions.setHidden.mock.calls).toEqual([
      ["b", true],
      ["c", false],
    ]);
    expect(actions.select).not.toHaveBeenCalled();
  });

  it("moves a dragged layer among its siblings only", () => {
    const { actions } = setUp();
    const rows = screen.getAllByRole("treeitem");
    const drag = (from: number, to: number) => {
      const dataTransfer = { setData: vi.fn(), effectAllowed: "" };
      fireEvent.dragStart(rows[from] as HTMLElement, { dataTransfer });
      fireEvent.dragOver(rows[to] as HTMLElement, { dataTransfer });
      fireEvent.drop(rows[to] as HTMLElement, { dataTransfer });
      fireEvent.dragEnd(rows[from] as HTMLElement, { dataTransfer });
    };

    // happy-dom lays nothing out, so every drop lands before the row it is on.
    drag(1, 3);
    drag(3, 1);
    // Another Section's sibling, and onto itself: nothing moves.
    drag(1, 4);
    drag(2, 2);

    expect(actions.move.mock.calls).toEqual([
      ["a", 1],
      ["c", 0],
    ]);
  });

  it("doesn't drag a selected layer while others are selected too, but drags one that isn't (#262)", () => {
    setUp("a", true, false, ["b"]);
    const draggable = screen
      .getAllByRole("treeitem")
      .map((row) => [row.getAttribute("data-layer"), row.getAttribute("draggable")]);

    expect(draggable).toEqual([
      ["s1", "true"],
      ["a", "false"],
      ["b", "false"],
      ["c", "true"],
      ["s2", "true"],
    ]);
  });

  it("works out where a dropped layer lands", () => {
    expect(dropIndex(0, 2, true)).toBe(2);
    expect(dropIndex(0, 2, false)).toBe(1);
    expect(dropIndex(2, 0, false)).toBe(0);
    expect(dropIndex(2, 0, true)).toBe(1);
  });

  it("runs the toolbar on the selected layer, and disables what isn't available", async () => {
    const { actions } = setUp("b");

    for (const name of ["Move up", "Move down", "Duplicate", "Delete"]) {
      await userEvent.click(screen.getByRole("button", { name }));
    }
    await userEvent.click(
      screen
        .getByRole("toolbar", { name: "Layer actions" })
        .querySelector("[title=\"Hide 'Hours'\"]") as HTMLElement,
    );
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));

    expect(actions.moveUp).toHaveBeenCalledOnce();
    expect(actions.remove).toHaveBeenCalledOnce();
    expect(actions.setHidden).toHaveBeenCalledWith("b", true);
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("disables the toolbar without a selection or commands, and says when the page is empty", () => {
    setUp(null, false);

    expect((screen.getByRole("button", { name: "Rename" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getAllByRole("treeitem")[0]?.tabIndex).toBe(0);
    cleanup();

    render(
      <LayersPanel
        layers={[]}
        selectedId={null}
        actions={{
          select: vi.fn(),
          toggle: vi.fn(),
          selectMany: vi.fn(),
          rename: vi.fn(),
          setHidden: vi.fn(),
          move: vi.fn(),
          moveUp: undefined,
          moveDown: undefined,
          duplicate: undefined,
          remove: undefined,
        }}
      />,
    );
    expect(screen.getByText(/no sections yet/)).toBeTruthy();
  });

  describe("tools (1.35)", () => {
    it("collapses and expands a layer with its arrow, ←/→, and the whole tree at once", async () => {
      setUp(null);
      const first = () => screen.getAllByRole("treeitem")[0];
      expect(first()?.getAttribute("aria-expanded")).toBe("true");
      expect(screen.getAllByRole("treeitem")[4]?.getAttribute("aria-expanded")).toBeNull();

      await userEvent.click(screen.getAllByTitle("Collapse Section")[0] as HTMLElement);
      expect(shown()).toEqual(["Section", "Section"]);
      expect(first()?.getAttribute("aria-expanded")).toBe("false");
      expect(screen.getByRole("treeitem", { name: "Section", expanded: false })).toBeTruthy();

      fireEvent.keyDown(screen.getAllByRole("treeitem")[0] as HTMLElement, { key: "ArrowRight" });
      expect(shown()).toHaveLength(5);
      fireEvent.keyDown(screen.getAllByRole("treeitem")[0] as HTMLElement, { key: "ArrowLeft" });
      expect(shown()).toHaveLength(2);

      await userEvent.click(screen.getByRole("button", { name: "Expand all" }));
      expect(shown()).toHaveLength(5);
      await userEvent.click(screen.getByRole("button", { name: "Collapse all" }));
      expect(shown()).toEqual(["Section", "Section"]);
    });

    it("goes to a layer's first child with →, its parent with ←", () => {
      const { actions } = setUp("a");
      const [section, first] = screen.getAllByRole("treeitem");

      fireEvent.keyDown(section as HTMLElement, { key: "ArrowRight" });
      fireEvent.keyDown(first as HTMLElement, { key: "ArrowLeft" });

      expect(actions.select.mock.calls).toEqual([["a"], ["s1"]]);
    });

    it("collapses the selected layer's parent, and opens it for a layer selected elsewhere", async () => {
      const props = {
        layers: LAYERS,
        actions: {
          select: vi.fn(),
          toggle: vi.fn(),
          selectMany: vi.fn(),
          rename: vi.fn(),
          setHidden: vi.fn(),
          move: vi.fn(),
          moveUp: undefined,
          moveDown: undefined,
          duplicate: undefined,
          remove: undefined,
        },
      };
      const view = render(<LayersPanel {...props} selectedId="a" />);

      // Collapsing the selected layer's parent hides it (#223 review).
      await userEvent.click(screen.getAllByTitle("Collapse Section")[0] as HTMLElement);
      expect(shown()).toEqual(["Section", "Section"]);

      // Selected elsewhere (the canvas): the layers it is in open, once.
      view.rerender(<LayersPanel {...props} selectedId="b" />);
      expect(shown()).toEqual(["Section", "Heading", "Hours Heading", "Heading", "Section"]);
      await userEvent.click(screen.getByRole("button", { name: "Collapse all" }));
      expect(shown()).toEqual(["Section", "Section"]);
    });

    it("filters by name or kind, keeping the layers a match is in; Esc clears it", async () => {
      setUp(null);
      const filter = screen.getByRole("searchbox", { name: "Filter layers" });

      await userEvent.type(filter, "hours");
      expect(shown()).toEqual(["Section", "Hours Heading"]);
      await userEvent.clear(filter);
      await userEvent.type(filter, "SECTION");
      expect(shown()).toEqual(["Section", "Section"]);
      await userEvent.type(filter, "x");
      expect(shown()).toEqual([]);
      expect(screen.getByText("No layers match")).toBeTruthy();

      await userEvent.type(filter, "{Escape}");
      expect((filter as HTMLInputElement).value).toBe("");
      expect(shown()).toHaveLength(5);
    });

    it("marks the rows a dragged layer can't go to, before anything is dropped", () => {
      const { actions } = setUp();
      const rows = screen.getAllByRole("treeitem");
      const dataTransfer = { setData: vi.fn(), effectAllowed: "" };

      fireEvent.dragStart(rows[1] as HTMLElement, { dataTransfer });

      expect(screen.getAllByRole("treeitem").map((row) => row.getAttribute("data-drop"))).toEqual([
        "not-allowed",
        null,
        null,
        null,
        "not-allowed",
      ]);
      // Over one of them, it isn't a drop target (the event isn't taken), and the row and the
      // panel say so: browsers show no tooltips in a drag.
      const over = fireEvent.dragOver(rows[4] as HTMLElement, { dataTransfer });
      expect(over).toBe(true);
      expect(screen.getAllByRole("treeitem")[4]?.className).toContain("var(--destructive)");
      expect(screen.getByRole("status").textContent).toBe(
        "Heading can only move among its own section's elements",
      );
      fireEvent.drop(rows[4] as HTMLElement, { dataTransfer });
      fireEvent.dragEnd(rows[1] as HTMLElement, { dataTransfer });

      expect(actions.move).not.toHaveBeenCalled();
      expect(screen.getAllByRole("treeitem").some((row) => row.hasAttribute("data-drop"))).toBe(
        false,
      );
    });

    it("opens the element menu on a right-click or Shift+F10, selecting the layer first", async () => {
      const { actions, lastMenu } = setUp("a");
      expect(lastMenu()?.at).toBeNull();

      fireEvent.contextMenu(screen.getAllByRole("treeitem")[2] as HTMLElement, {
        button: 2,
        clientX: 20,
        clientY: 30,
      });
      expect(actions.select).toHaveBeenCalledWith("b");
      expect(lastMenu()?.at).toEqual({ x: 20, y: 30 });

      act(() => lastMenu()?.onClose());
      expect(lastMenu()?.at).toBeNull();
      // Shift+F10 or the Menu key: the browser's contextmenu, with no pointer, opens it by the row.
      fireEvent.contextMenu(screen.getAllByRole("treeitem")[1] as HTMLElement);
      expect(lastMenu()?.at).toEqual({ x: 16, y: 0 });

      // Closed, it gives the focus back to the selected layer's row (#223 review).
      act(() => lastMenu()?.onCloseFocus());
      await waitFor(() =>
        expect(document.activeElement?.getAttribute("data-layer")).toBe(
          screen.getAllByRole("treeitem")[1]?.getAttribute("data-layer"),
        ),
      );

      // Its Rename renames the selected layer in place, and the name field keeps the focus.
      act(() => {
        lastMenu()?.onRename();
        lastMenu()?.onCloseFocus();
      });
      const field = screen.getByRole("textbox", { name: "Name for this Heading" });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      expect(document.activeElement).toBe(field);
    });

    it("marks locked and animated layers, as it marks linked and hidden ones", () => {
      render(
        <LayersPanel
          layers={[
            layer("h", { kind: "Header", locked: true }),
            layer("t", { kind: "Text", animated: true }),
            layer("c", { kind: "Section", sharedSection: "Hours" }),
          ]}
          selectedId={null}
          actions={{
            select: vi.fn(),
            toggle: vi.fn(),
            selectMany: vi.fn(),
            rename: vi.fn(),
            setHidden: vi.fn(),
            move: vi.fn(),
            moveUp: undefined,
            moveDown: undefined,
            duplicate: undefined,
            remove: undefined,
          }}
        />,
      );

      expect(shown()).toEqual([
        "Locked: it can't be moved or deleted Header",
        "Animated Text",
        "Linked copy of 'Hours' Section",
      ]);
      expect(screen.getByTitle("Locked: it can't be moved or deleted")).toBeTruthy();
      expect(screen.getByTitle("Animated")).toBeTruthy();
    });
  });
});
