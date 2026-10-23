import type { Meta, StoryObj } from "@storybook/react-vite";
import { ErrorFallback } from "./error-boundary.js";

const meta = {
  title: "Base/ErrorFallback",
  component: ErrorFallback,
  parameters: { layout: "centered" },
  args: {
    message: "Something went wrong in this panel. Your work is saved.",
    actionLabel: "Reload panel",
    onAction: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="h-64 w-72 border border-border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ErrorFallback>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A panel that threw while rendering, in its tab. */
export const Panel: Story = {};
