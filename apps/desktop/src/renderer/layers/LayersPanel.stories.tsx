import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { LayersPanel, type LayersPanelActions } from "./LayersPanel.js";
import type { Layer } from "./layers.js";

const layer = (id: string, kind: string, extra: Partial<Layer> = {}): Layer => ({
  id,
  kind,
  name: undefined,
  hidden: false,
  children: [],
  ...extra,
});

const noop = () => undefined;
const actions: LayersPanelActions = {
  select: noop,
  rename: noop,
  setHidden: noop,
  move: noop,
  moveUp: noop,
  moveDown: noop,
  duplicate: noop,
  remove: noop,
};

const meta = {
  title: "Panels/Layers",
  component: LayersPanel,
  args: {
    layers: [
      layer("hero", "Section", {
        children: [
          layer("h1", "Heading"),
          layer("t1", "Text", { name: "Opening times" }),
          layer("old", "Text", { hidden: true }),
        ],
      }),
      layer("faq", "FAQ", { children: [layer("q1", "Question"), layer("q2", "Question")] }),
    ],
    selectedId: "t1",
    actions,
  },
  // In a panel-sized frame, as in the left column.
  render: (args) => (
    <div className="h-72 w-60 border border-border-strong bg-panel">
      <LayersPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof LayersPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sections and their elements: a named layer selected, a hidden one struck through. */
export const Default: Story = {};

/** Renaming a layer in place (F2 or a double-click). */
export const Renaming: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.dblClick(within(canvasElement).getAllByRole("treeitem")[1] as HTMLElement);
  },
};

/** A page with no sections yet. */
export const Empty: Story = { args: { layers: [], selectedId: null } };
