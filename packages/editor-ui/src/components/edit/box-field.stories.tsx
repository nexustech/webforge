import type { Meta, StoryObj } from "@storybook/react-vite";
import type { EditPanelField } from "./edit-panel.js";
import { FieldStory, fieldStoryFrame } from "./field-story.js";

const tokens = ["None", "S", "M", "L", "XL"].map((label) => ({
  label,
  value: label.toLowerCase(),
}));
const sides = ["Top", "Right", "Bottom", "Left"].map((label) => ({
  label,
  value: label.toLowerCase(),
}));

/** A spacing token per side, or one for every side (BoxField, 1.32). */
const field = {
  name: "padding",
  kind: "box",
  label: "Padding",
  group: "style",
  value: { top: "l", bottom: "l" },
  options: tokens,
  sides,
} satisfies EditPanelField;

const meta = {
  title: "Edit/Fields/Box",
  component: FieldStory,
  args: { field },
  decorators: [fieldStoryFrame],
} satisfies Meta<typeof FieldStory>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Two sides set, so a row per side. */
export const Default: Story = {};

/** Can't be changed now: shown greyed out, and Tab skips it. */
export const Disabled: Story = { args: { field: { ...field, disabled: true } } };

/** Its value isn't acceptable: the message below it, which the control is described by. */
export const WithError: Story = {
  args: { field: { ...field, error: "Use the same padding on the left and right" } },
};

/** Seen on Mobile, with a value set for Mobile only: the accent dot beside its label (UX-19). */
export const Overridden: Story = {
  args: {
    field: { ...field, responsive: true, overridden: true, changed: true },
    device: "Mobile",
  },
};
