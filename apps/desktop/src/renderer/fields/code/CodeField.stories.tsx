import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeField } from "./CodeField.js";

// The Edit panel's code field.

const meta = {
  title: "Edit/Fields/Code",
  component: CodeField,
  args: {
    id: "field-code",
    labelId: "field-code-label",
    field: { kind: "code", label: "Code" },
    value: undefined,
    onChange: () => undefined,
    onCommit: () => undefined,
  },
  // As in the Edit panel: its label above, in the right column's width.
  render: (args) => (
    <div className="flex w-60 flex-col gap-1 border border-border-strong bg-panel p-2">
      <span id="field-code-label" className="text-xs text-muted-foreground">
        Code
      </span>
      <CodeField {...args} />
    </div>
  ),
} satisfies Meta<typeof CodeField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing set yet. */
export const Empty: Story = {};

/** Filled in. */
export const Filled: Story = { args: { value: "Code" } };
