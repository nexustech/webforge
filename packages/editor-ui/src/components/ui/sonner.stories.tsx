import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { Toaster, toast } from "./sonner.js";

const meta = {
  title: "Base/Toaster",
  component: Toaster,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

function UndoToast() {
  useEffect(() => {
    // An Undo toast as 1.11 shows it after a delete; it stays until dismissed.
    toast("Deleted Heading", {
      action: { label: "Undo", onClick: () => undefined },
      duration: Number.POSITIVE_INFINITY,
    });
  }, []);
  return null;
}

export const Undo: Story = {
  render: (_args, { globals }) => (
    <div className="h-40">
      <Toaster theme={globals.theme === "light" ? "light" : "dark"} />
      <UndoToast />
    </div>
  ),
};
