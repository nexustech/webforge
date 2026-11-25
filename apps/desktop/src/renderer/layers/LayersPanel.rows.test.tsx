// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import { reactCompiled } from "@webforge/test-utils/vitest";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { keepUnchanged, type Layer } from "../editor/layers.js";
import { LayersPanel, type LayersPanelActions } from "./LayersPanel.js";

type RowProps = ComponentProps<typeof import("./LayerRow.js").LayerRow>;

/** Each row's props, by its layer's id, every time the panel drew it. */
const given = vi.hoisted(() => new Map<string, RowProps[]>());
vi.mock("./LayerRow.js", async (actual) => {
  const real = await actual<typeof import("./LayerRow.js")>();
  return {
    LayerRow: (props: RowProps) => {
      given.set(props.row.layer.id, [...(given.get(props.row.layer.id) ?? []), props]);
      return <real.LayerRow {...props} />;
    },
  };
});

afterEach(() => {
  cleanup();
  given.clear();
});

const layer = (id: string, extra: Partial<Layer> = {}): Layer => ({
  id,
  kind: "Heading",
  name: undefined,
  hidden: false,
  children: [],
  ...extra,
});

const tree = (name?: string): Layer[] => [
  layer("s1", { kind: "Section", children: [layer("a"), layer("b", { name })] }),
  layer("s2", { kind: "Section" }),
];

const actions: LayersPanelActions = {
  select: vi.fn(),
  toggle: vi.fn(),
  selectMany: vi.fn(),
  rename: vi.fn(),
  setShown: vi.fn(),
  move: vi.fn(),
  moveUp: undefined,
  moveDown: undefined,
  duplicate: undefined,
  remove: undefined,
};

/** The rows whose props changed since the panel last drew them: those that draw again. */
const changed = () =>
  [...given].flatMap(([id, renders]) => {
    const [before, after] = renders.slice(-2);
    if (before === undefined || after === undefined) return [id];
    const keys = Object.keys(after) as (keyof RowProps)[];
    return keys.some((key) => before[key] !== after[key]) ? [id] : [];
  });

// Its props stay the same objects through the React Compiler's memoising, as in the app.
describe.runIf(reactCompiled())("a Layers row draws again only when it changed (#1406)", () => {
  const panel = (layers: readonly Layer[], selectedId: string) => (
    <LayersPanel layers={layers} selectedId={selectedId} actions={actions} menu={() => null} />
  );

  it("as the selection moves: the rows it left and moved to", () => {
    const layers = tree();
    const { rerender } = render(panel(layers, "a"));

    rerender(panel(layers, "b"));

    expect(changed()).toEqual(["a", "b"]);
  });

  it("as the page changes: the rows of the layers that changed, and of those holding them", () => {
    const layers = tree();
    const { rerender } = render(panel(layers, "a"));

    rerender(panel(keepUnchanged(layers, tree("Hours")), "a"));

    expect(changed()).toEqual(["s1", "b"]);
  });
});
