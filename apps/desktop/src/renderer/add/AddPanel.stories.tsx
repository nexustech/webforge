import type { Meta, StoryObj } from "@storybook/react-vite";
import { siteLibrary } from "@webforge/site-components";
import { userEvent, within } from "storybook/test";
import { AddPanel } from "./AddPanel.js";
import { addItems } from "./add-items.js";

const noop = () => undefined;
const anywhere = (_type: string): boolean => true;

const meta = {
  title: "Panels/Add",
  component: AddPanel,
  args: {
    sections: addItems(siteLibrary, "sections"),
    elements: addItems(siteLibrary, "elements"),
    tab: "sections",
    onTabChange: noop,
    onAdd: noop,
    canAdd: anywhere,
    point: null,
    onCancelPoint: noop,
  },
  // In a panel-sized frame, as in the left column.
  render: (args) => (
    <div className="h-96 w-60 border border-border-strong bg-panel">
      <AddPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof AddPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sections, by category. */
export const Sections: Story = {};

/** Opened by the canvas's +: the section chosen goes after the Hero. */
export const AtThePlus: Story = { args: { point: { after: "Hero" } } };

/** Elements, which go into the selected section. */
export const Elements: Story = { args: { tab: "elements" } };

/** Elements on a page with no section to take them. */
export const NoSection: Story = { args: { tab: "elements", canAdd: () => false } };

/** A search that finds nothing. */
export const NoMatch: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(within(canvasElement).getByRole("searchbox"), "pricing");
  },
};
