import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import type { EditPanelField } from "./edit-panel-types.js";
import { FieldStory, fieldStoryFrame } from "./field-story.js";

const sizes = [
  { label: "Small", value: "small" },
  { label: "Medium", value: "medium" },
  { label: "Large", value: "large" },
];

/** A step along a token scale, its name beside it (SliderField). */
const field = {
  name: "gap",
  kind: "slider",
  label: "Space between elements",
  group: "style",
  value: "medium",
  steps: sizes,
} satisfies EditPanelField;

const meta = {
  title: "Edit/Fields/Slider",
  component: FieldStory,
  args: { heading: "Section", field },
  decorators: [fieldStoryFrame],
} satisfies Meta<typeof FieldStory>;
export default meta;
type Story = StoryObj<typeof meta>;

/** On the middle step. */
export const Default: Story = {};

/** Reached with Tab: the focus ring the other controls show (F12, #1179). */
export const Focused: Story = {
  play: async ({ canvasElement }) => {
    const slider = within(canvasElement).getByRole("slider", { name: "Space between elements" });
    for (let tabs = 0; tabs < 10 && canvasElement.ownerDocument.activeElement !== slider; tabs++) {
      await userEvent.tab();
    }
    await expect(slider).toHaveFocus();
  },
};

/** Can't be changed now: shown greyed out, and Tab skips it. */
export const Disabled: Story = { args: { field: { ...field, disabled: true } } };

/** Its value isn't acceptable: the message below it, which the control is described by. */
export const WithError: Story = {
  args: { field: { ...field, error: "Use a smaller space on Mobile" } },
};

/** Seen on Mobile, with a value set for Mobile only: the accent dot beside its label (UX-19). */
export const Overridden: Story = {
  args: {
    field: { ...field, responsive: true, overridden: true, changed: true },
    device: "Mobile",
  },
};
