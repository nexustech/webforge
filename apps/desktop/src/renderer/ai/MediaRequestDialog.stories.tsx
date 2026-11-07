import type { Meta, StoryObj } from "@storybook/react-vite";
import { MediaRequestDialog } from "./MediaRequestDialog.js";

const meta = {
  title: "AI/MediaRequestDialog",
  component: MediaRequestDialog,
  args: { onAnswer: () => undefined },
} satisfies Meta<typeof MediaRequestDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Claude asks for the garage's own photos, to replace the template's (4.12b). */
export const Asking: Story = {
  args: {
    open: true,
    asked: {
      app: "Claude Desktop",
      reason: "Photos of your workshop, your team and a finished job",
    },
  },
};
