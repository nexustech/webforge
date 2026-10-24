import type { Meta, StoryObj } from "@storybook/react-vite";
import { SwatchField } from "./swatch-field.js";

/** The light theme's text colour and three of its roles, as the colour field shows them. */
const OPTIONS = [
  { value: "default", label: "Text colour", colour: "oklch(21% 0.006 285.885)" },
  { value: "primary", label: "Primary", colour: "oklch(45% 0.24 277.023)" },
  { value: "secondary", label: "Secondary", colour: "oklch(53% 0.241 354.308)" },
  { value: "accent", label: "Accent", colour: "oklch(50% 0.152 181.912)" },
];

const meta = {
  title: "Edit/SwatchField",
  component: SwatchField,
  args: {
    id: "colour",
    labelId: "colour-label",
    options: OPTIONS,
    value: "primary",
    onChoose: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="flex w-64 flex-col gap-1 bg-panel p-2">
        <span id="colour-label" className="text-xs text-muted-foreground">
          Colour
        </span>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SwatchField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A theme colour chosen that reads well on the page. */
export const Chosen: Story = {};

/** A colour too light for text on the page: the warning says so. */
export const LowContrast: Story = {
  args: {
    value: "accent",
    warning: "Hard to read on the page: contrast 1.9:1, less than the 4.5:1 text needs.",
  },
};
