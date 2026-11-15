import type { Meta, StoryObj } from "@storybook/react-vite";
import type { PageId } from "@webforge/model";
import { userEvent, within } from "storybook/test";
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

/**
 * The toolbar narrower (#1008), as smaller windows and wider side columns leave it: the controls
 * that don't fit move into the View menu, never Desktop, Tablet or Mobile.
 */
const at = (width: number): Story => ({
  render: (args) => (
    <div style={{ width }}>
      <CanvasToolbar {...args} />
    </div>
  ),
});

/** 640 px: the size read-out is an icon, its device list behind it. */
export const At640: Story = at(640);

/** 542 px: the width box is in the View menu too. */
export const At542: Story = at(542);

/** 478 px: Zoom In, Zoom Out and Rotate are in the View menu too. */
export const At478: Story = at(478);

/** 384 px, the toolbar at the smallest window: the page list narrower. */
export const AtSmallestWindow: Story = at(384);

/** The View menu at the smallest window, holding what the toolbar has no room for. */
export const ViewMenuAtSmallestWindow: Story = {
  ...at(384),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "View" }));
  },
};
