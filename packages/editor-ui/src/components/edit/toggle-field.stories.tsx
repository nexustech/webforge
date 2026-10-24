import type { Meta, StoryObj } from "@storybook/react-vite";
import type { EditPanelField } from "./edit-panel.js";
import { FieldStory, fieldStoryFrame } from "./field-story.js";

/** On or off, as a switch (ToggleField). */
const field = {
  name: "fullWidth",
  kind: "toggle",
  label: "Full width",
  group: "style",
  value: true,
} satisfies EditPanelField;

const meta = {
  title: "Edit/Fields/Toggle",
  component: FieldStory,
  args: { field },
  decorators: [fieldStoryFrame],
} satisfies Meta<typeof FieldStory>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Switched on. */
export const Default: Story = {};

/** Can't be changed now: shown greyed out, and Tab skips it. */
export const Disabled: Story = { args: { field: { ...field, disabled: true } } };

/** Its value isn't acceptable: the message below it, which the control is described by. */
export const WithError: Story = {
  args: { field: { ...field, error: "A full-width section needs a background" } },
};

/** Seen on Mobile, with a value set for Mobile only: the accent dot beside its label (UX-19). */
export const Overridden: Story = {
  args: {
    field: { ...field, responsive: true, overridden: true, changed: true },
    device: "Mobile",
  },
};
