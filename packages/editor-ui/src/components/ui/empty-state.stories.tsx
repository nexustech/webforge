import type { Meta, StoryObj } from "@storybook/react-vite";
import { ImageIcon, LayersIcon } from "lucide-react";
import { Button } from "./button.js";
import { EmptyState } from "./empty-state.js";

const meta = {
  title: "Base/EmptyState",
  component: EmptyState,
  parameters: { layout: "centered" },
  args: { children: "Nothing here yet." },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The text alone: a list with nothing in it. */
export const Text: Story = {
  render: () => <EmptyState>Nothing in this list yet.</EmptyState>,
};

/** With an icon: a panel's whole empty state. */
export const WithIcon: Story = {
  render: () => (
    <EmptyState icon={LayersIcon}>
      This page has no sections yet. Add one from the Add panel's Sections.
    </EmptyState>
  ),
};

/** With the next step as a button. */
export const WithAction: Story = {
  render: () => (
    <EmptyState
      icon={ImageIcon}
      action={
        <Button size="sm" variant="outline">
          Import Images…
        </Button>
      }
    >
      No images yet.
    </EmptyState>
  ),
};
