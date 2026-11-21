import type { Meta, StoryObj } from "@storybook/react-vite";
import { hexToOklch } from "@webforge/themes";
import { ThemeColorField } from "./ThemeColorField.js";

const meta = {
  title: "Edit/Fields/Theme colour",
  component: ThemeColorField,
  args: {
    id: "field-brand",
    labelId: "field-brand-label",
    field: { kind: "themeColor", label: "Brand", warnings: [] },
    value: hexToOklch("#4b3fd1"),
    onChange: () => undefined,
    onCommit: () => undefined,
  },
  // As in the Theme tab: its label above, in the right column's width.
  render: (args) => (
    <div className="flex w-60 flex-col gap-1 border border-border-strong bg-panel p-2">
      <span id="field-brand-label" className="text-xs text-muted-foreground">
        Brand
      </span>
      <ThemeColorField {...args} />
    </div>
  ),
} satisfies Meta<typeof ThemeColorField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A colour that reads well with everything it's used with. */
export const Readable: Story = {};

/**
 * A pale brand colour: hard to read on the page, and its own text hard to read on it, as Advanced
 * mode says it, with a shade that reads (#1174).
 */
export const HardToRead: Story = {
  args: {
    value: hexToOklch("#c7c2f5"),
    field: {
      kind: "themeColor",
      label: "Brand",
      warnings: [
        "Text on Brand is hard to read on Brand: 1.4:1, needs 4.5:1",
        "Brand is hard to read on Surface: 1.6:1, needs 4.5:1",
      ],
      suggestion: { value: hexToOklch("#5b4fd6"), label: "Use a darker shade" },
    },
  },
};

/** In Simple mode's Theme tab (LF-16): no hex code, and the warnings in words alone. */
export const Simple: Story = {
  args: {
    value: hexToOklch("#c7c2f5"),
    field: {
      kind: "themeColor",
      label: "Brand",
      code: false,
      warnings: ["Text on Brand is hard to read on Brand", "Brand is hard to read on Surface"],
      suggestion: { value: hexToOklch("#5b4fd6"), label: "Use a darker shade" },
    },
  },
};

/** In Content mode. */
export const Disabled: Story = { args: { disabled: true } };
