import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconField } from "./IconField.js";

const meta = {
  title: "Edit/IconField",
  component: IconField,
  args: {
    id: "field-icon",
    labelId: "field-icon-label",
    field: { kind: "icon", label: "Icon" },
    value: undefined,
    onChange: () => undefined,
    onCommit: () => undefined,
  },
  // As in the Edit panel: its label above, in the right column's width.
  render: (args) => (
    <div className="flex w-60 flex-col gap-1 border border-border-strong bg-panel p-2">
      <span id="field-icon-label" className="text-xs text-muted-foreground">
        Icon
      </span>
      <IconField {...args} />
    </div>
  ),
} satisfies Meta<typeof IconField>;

export default meta;
type Story = StoryObj<typeof meta>;

// No story opens the picker: it draws all 1,891 icons, and the Picker's own stories show it.

/** No icon chosen yet. */
export const Empty: Story = {};

/** An icon chosen, with the button that takes it away. */
export const Chosen: Story = { args: { value: "phone" } };

/** In Content mode, or on a locked element. */
export const Disabled: Story = { args: { value: "phone", disabled: true } };
