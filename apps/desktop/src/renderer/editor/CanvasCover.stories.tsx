import type { Meta, StoryObj } from "@storybook/react-vite";
import { t } from "@webforge/i18n";
import { CanvasCover } from "./CanvasCover.js";

// The canvas's cover (#1013, #1167): over the canvas while a site opens, saying so once it has
// taken more than half a second.

const meta = {
  title: "Editor/CanvasCover",
  component: CanvasCover,
  decorators: [
    (Story) => (
      <div style={{ position: "relative", height: 320 }}>
        <Story />
      </div>
    ),
  ],
  args: { engine: null },
} satisfies Meta<typeof CanvasCover>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A site still opening after half a second: "Opening your site…", with a spinner. */
export const Opening: Story = {
  play: async ({ canvasElement }) => {
    for (let tries = 0; tries < 50; tries++) {
      if (canvasElement.textContent?.includes(t("canvas.opening"))) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("The cover never said the site is opening");
  },
};
