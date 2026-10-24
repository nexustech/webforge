import type { Meta, StoryObj } from "@storybook/react-vite";
import { HeadingLevelToolbar } from "../editor/HeadingToolbar.js";
import { ElementToolbarRow } from "./ElementToolbarRow.js";

const meta = {
  title: "Shell/ElementToolbarRow",
  component: ElementToolbarRow,
  // Under the canvas toolbar, as wide as the canvas in a 1280 px window.
  render: (args) => (
    <div className="w-[760px]">
      <ElementToolbarRow {...args} />
    </div>
  ),
} satisfies Meta<typeof ElementToolbarRow>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing selected, or an element without a toolbar of its own: the row stays, empty. */
export const Empty: Story = {};

/** A Heading selected: its level, centred (SP-4). */
export const HeadingSelected: Story = {
  args: { children: <HeadingLevelToolbar value="medium" onChange={() => undefined} /> },
};
