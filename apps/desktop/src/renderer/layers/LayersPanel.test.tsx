// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dropIndex, LayersPanel, type LayersPanelActions } from "./LayersPanel.js";
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

function setUp(selectedId: string | null = "a", toolbar = true) {
  const command = () => (toolbar ? vi.fn() : undefined);
  const actions = {
    select: vi.fn(),
    rename: vi.fn(),
    setHidden: vi.fn(),
    move: vi.fn(),
    moveUp: command(),
    moveDown: command(),
    duplicate: command(),
    remove: command(),
  } satisfies LayersPanelActions;
  render(<LayersPanel layers={LAYERS} selectedId={selectedId} actions={actions} />);
  const item = (name: RegExp) => screen.getByRole("treeitem", { name });
  return { actions, item };
}

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

  it("selects on click and with the arrow keys; Alt+arrows move among siblings", async () => {
    const { actions } = setUp();
    const rows = screen.getAllByRole("treeitem");

    await userEvent.click(rows[4] as HTMLElement);
    fireEvent.keyDown(rows[1] as HTMLElement, { key: "ArrowDown" });
    fireEvent.keyDown(rows[1] as HTMLElement, { key: "ArrowUp" });
    fireEvent.keyDown(rows[0] as HTMLElement, { key: "ArrowUp" });
    fireEvent.keyDown(rows[1] as HTMLElement, { key: "ArrowDown", altKey: true });
    fireEvent.keyDown(rows[2] as HTMLElement, { key: "ArrowUp", altKey: true });

    expect(actions.select.mock.calls).toEqual([["s2"], ["b"], ["s1"]]);
    expect(actions.move.mock.calls).toEqual([
      ["a", 1],
      ["b", 0],
    ]);
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
});
