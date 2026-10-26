import type { Meta, StoryObj } from "@storybook/react-vite";
import { DEFAULT_THEME, type ImageMeta, type MediaId } from "@webforge/model";
import { userEvent, within } from "storybook/test";
import { StudioImagePalette } from "./StudioImagePalette.js";

/** A logo in Media: a square of red over blue, drawn here, so the story needs no files. */
const logo: ImageMeta = {
  id: "logo" as MediaId,
  hash: "logo".padEnd(64, "0"),
  name: "logo",
  fileName: "Logo.png",
  kind: "image",
  mimeType: "image/png",
  width: 64,
  height: 64,
  alt: "Rosa's Bakery",
};

const LOGO_URL = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="2" height="1" fill="#dc1e28"/><rect y="1" width="2" height="1" fill="#143cc8"/></svg>',
)}`;

/** The logo's pixels as a canvas reads them: red and blue, half each. */
const LOGO_PIXELS = Uint8ClampedArray.from([
  ...Array.from({ length: 32 }, () => [220, 30, 40, 255]).flat(),
  ...Array.from({ length: 32 }, () => [20, 60, 200, 255]).flat(),
]);

const meta = {
  title: "Dialogs/Theme Studio/Colours from an image",
  component: StudioImagePalette,
  args: {
    media: { [logo.id]: logo },
    theme: DEFAULT_THEME,
    onUse: () => Promise.resolve(false),
    imageUrl: () => LOGO_URL,
    read: () => Promise.resolve(LOGO_PIXELS),
  },
  // In Theme Studio's column width.
  render: (args) => (
    <div className="w-[44rem] bg-panel p-3">
      <StudioImagePalette {...args} />
    </div>
  ),
} satisfies Meta<typeof StudioImagePalette>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Before an image is chosen. */
export const Start: Story = {};

/** The brand colours a red and blue logo proposes, each with its text, to use or put away. */
export const Proposed: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Colours from an image…" }),
    );
    const picker = within(document.body).getByRole("dialog", { name: "Choose an image" });
    await userEvent.dblClick(within(picker).getByRole("option", { name: /Logo\.png/ }));
    await within(canvasElement).findByRole("list", { name: "Colours from Logo.png" });
  },
};
