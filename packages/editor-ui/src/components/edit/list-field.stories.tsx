import type { Meta, StoryObj } from "@storybook/react-vite";
import type { EditPanelField } from "./edit-panel.js";
import { FieldStory, fieldStoryFrame } from "./field-story.js";

/** A repeating list, a row per item (ListField, F-ED-6). */
const field = {
  name: "testimonials",
  kind: "list",
  label: "Testimonials",
  group: "content",
  itemLabel: "Testimonial",
  itemFields: [
    { name: "quote", kind: "text", label: "Quote" },
    { name: "author", kind: "text", label: "Name" },
  ],
  value: [
    { id: "a", quote: "The best bread in town", author: "Sam" },
    { id: "b", quote: "Friendly and fast", author: "Alex" },
  ],
} satisfies EditPanelField;

const meta = {
  title: "Edit/Fields/List",
  component: FieldStory,
  args: { field },
  decorators: [fieldStoryFrame],
} satisfies Meta<typeof FieldStory>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Two items, closed. */
export const Default: Story = {};

/** Can't be changed now: shown greyed out, and Tab skips it. */
export const Disabled: Story = { args: { field: { ...field, disabled: true } } };

/** Its value isn't acceptable: the message below it, which the control is described by. */
export const WithError: Story = {
  args: { field: { ...field, error: "Add at most 12 testimonials" } },
};

/** Seen on Mobile, with a value set for Mobile only: the accent dot beside its label (UX-19). */
export const Overridden: Story = {
  args: {
    field: { ...field, responsive: true, overridden: true, changed: true },
    device: "Mobile",
  },
};
