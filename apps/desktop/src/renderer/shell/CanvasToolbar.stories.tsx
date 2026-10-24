import type { Meta, StoryObj } from "@storybook/react-vite";
import type { PageId } from "@webforge/model";
import { DEFAULT_PREFERENCES } from "../../shared/ipc/prefs.js";
import { CanvasToolbar } from "./CanvasToolbar.js";

const noop = () => undefined;

const meta = {
  title: "Shell/CanvasToolbar",
  component: CanvasToolbar,
  args: {
    pages: [
      { id: "home" as PageId, title: "Home" },
      { id: "about" as PageId, title: "About us" },
      { id: "contact" as PageId, title: "Contact" },
    ],
    shownPageId: "about" as PageId,
    onShowPage: noop,
    viewport: "desktop",
    onViewportChange: noop,
    zoom: "fit",
    onZoomChange: noop,
    size: { width: 1280, height: 2140, zoom: 0.58 },
    canvas: DEFAULT_PREFERENCES.canvas,
    onCanvasChange: noop,
  },
  // Over the canvas, as wide as it is in a 1280 px window.
  render: (args) => (
    <div className="w-[760px]">
      <CanvasToolbar {...args} />
    </div>
  ),
} satisfies Meta<typeof CanvasToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The Desktop view. */
export const Desktop: Story = {};

/** A custom width at a chosen zoom: no device view is chosen. */
export const CustomWidth: Story = {
  args: { viewport: 900, zoom: 0.75, size: { width: 900, height: 2400, zoom: 0.75 } },
};

/** Before the canvas has shown the page: no size yet. */
export const SizeUnknown: Story = { args: { size: null } };
