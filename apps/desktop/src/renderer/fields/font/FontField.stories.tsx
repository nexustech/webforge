import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { FontField } from "./FontField.js";
import { fakeFonts } from "./fake-fonts.js";

const FONTS = fakeFonts();

const meta = {
  title: "Edit/Fields/Font",
  component: FontField,
  args: {
    id: "field-font",
    labelId: "field-font-label",
    field: { kind: "font", label: "Headings" },
    value: { family: "Playfair Display", fallback: "serif" },
    onChange: () => undefined,
    onCommit: () => undefined,
    fonts: () => FONTS,
  },
  // As in the Theme tab: its label above, in the right column's width.
  render: (args) => (
    <div className="flex w-60 flex-col gap-1 border border-border-strong bg-panel p-2">
      <span id="field-font-label" className="text-xs text-muted-foreground">
        Headings
      </span>
      <FontField {...args} />
    </div>
  ),
} satisfies Meta<typeof FontField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A font chosen: its name, in itself. */
export const Chosen: Story = {};

/** No font yet. */
export const Empty: Story = { args: { value: null } };

/** The font picker, on the font chosen, with its sample text. */
export const Picker: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
  },
};

/** *Browse all fonts* listed: the fonts there are to download, under To download. */
export const Browsed: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    const picker = within(document.body).getByRole("dialog", { name: "Choose a font" });
    await userEvent.click(within(picker).getByRole("button", { name: "Browse all fonts" }));
    await within(picker).findByText(/more fonts to download/);
    await userEvent.click(within(picker).getByRole("button", { name: "To download" }));
  },
};
