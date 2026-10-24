import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import type { EditPanelField } from "./edit-panel.js";
import { FieldStory, fieldStoryFrame } from "./field-story.js";

/** A one-line text field (TextField). */
const field = {
  name: "title",
  kind: "text",
  label: "Title",
  group: "content",
  value: "Fresh bread every morning",
  placeholder: "A short title",
} satisfies EditPanelField;

const meta = {
  title: "Edit/Fields/Text",
  component: FieldStory,
  args: { heading: "Section", field },
  decorators: [fieldStoryFrame],
} satisfies Meta<typeof FieldStory>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Its text, changed with every keystroke. */
export const Default: Story = {};

/** Can't be changed now: shown greyed out, and Tab skips it. */
export const Disabled: Story = { args: { field: { ...field, disabled: true } } };

/** Its value isn't acceptable: the message below it, which the control is described by. */
export const WithError: Story = {
  args: { field: { ...field, error: "Use at most 80 characters" } },
};

/** Seen on Mobile, with a value set for Mobile only: the accent dot beside its label (UX-19). */
export const Overridden: Story = {
  args: {
    field: { ...field, responsive: true, overridden: true, changed: true },
    device: "Mobile",
  },
};

/** An anchor ID, checked when the field is left (F-ED-11): invalid text is shown, not saved. */
export const Validate: Story = {
  args: {
    field: {
      name: "anchorId",
      kind: "text",
      label: "Anchor ID",
      group: "content",
      value: "",
      validate: (value) =>
        /^([a-z0-9]+(-[a-z0-9]+)*)?$/.test(value)
          ? undefined
          : "Use lowercase letters, digits and single hyphens",
    },
  },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", { name: "Anchor ID" });
    await userEvent.type(input, "Opening times");
    await userEvent.tab();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAccessibleDescription(
      "Use lowercase letters, digits and single hyphens",
    );
  },
};
