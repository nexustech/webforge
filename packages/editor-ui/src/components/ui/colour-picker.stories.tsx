import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { ColourPicker } from "./colour-picker.js";

/** A field's row: its label and the picker, which shows the colour chosen. */
function Field({ start }: { readonly start: string }) {
  const [colour, setColour] = useState(start);
  return (
    <div className="flex h-80 w-72 items-start gap-2">
      <span id="brand-label" className="text-sm">
        Brand
      </span>
      <ColourPicker value={colour} aria-labelledby="brand-label" onChoose={setColour} />
    </div>
  );
}

const meta = {
  title: "Base/ColourPicker",
  component: Field,
  parameters: { layout: "centered" },
  args: { start: "#1a7f5a" },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed: the swatch, named by its field. */
export const Closed: Story = {};

/**
 * Open (5.26, OL-19): the saturation and brightness area, the hue slider and the hex code, and the
 * eyedropper where the window has one. Its popover is outside the story's root, in the page.
 */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Brand" }));
    const page = within(canvasElement.ownerDocument.body);
    await expect(page.getByRole("dialog", { name: "Colour picker" })).toBeVisible();
  },
};

/** A hex code that isn't one, refused with the reason. */
export const RefusedCode: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Brand" }));
    const page = within(canvasElement.ownerDocument.body);
    const code = page.getByRole("textbox", { name: "Hex code" });
    await userEvent.clear(code);
    await userEvent.type(code, "#12{Enter}");
    await expect(code).toHaveAttribute("aria-invalid", "true");
  },
};
