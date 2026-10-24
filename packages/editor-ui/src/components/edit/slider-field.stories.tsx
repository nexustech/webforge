import type { Meta, StoryObj } from "@storybook/react-vite";
import type { EditPanelField } from "./edit-panel.js";
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
  args: { field },
  decorators: [fieldStoryFrame],
} satisfies Meta<typeof FieldStory>;
export default meta;
type Story = StoryObj<typeof meta>;

/** On the middle step. */
export const Default: Story = {};

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
