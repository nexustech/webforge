import type { Meta, StoryObj } from "@storybook/react-vite";
import type { EditPanelField } from "./edit-panel.js";
import { FieldStory, fieldStoryFrame } from "./field-story.js";

/** A choice from a short list, as a native select (SelectField). */
const field = {
  name: "alignment",
  kind: "select",
  label: "Alignment",
  group: "style",
  value: "centre",
  options: [
    { label: "Left", value: "left" },
    { label: "Centre", value: "centre" },
    { label: "Right", value: "right" },
  ],
} satisfies EditPanelField;

const meta = {
  title: "Edit/Fields/Select",
  component: FieldStory,
  args: { heading: "Section", field },
  decorators: [fieldStoryFrame],
} satisfies Meta<typeof FieldStory>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The chosen option. */
export const Default: Story = {};

/** Can't be changed now: shown greyed out, and Tab skips it. */
export const Disabled: Story = { args: { field: { ...field, disabled: true } } };

/** Its value isn't acceptable: the message below it, which the control is described by. */
export const WithError: Story = {
  args: { field: { ...field, error: "Choose how the text lines up" } },
};

/** Seen on Mobile, with a value set for Mobile only: the accent dot beside its label (UX-19). */
export const Overridden: Story = {
  args: {
    field: { ...field, responsive: true, overridden: true, changed: true },
    device: "Mobile",
  },
};
