import type { Meta, StoryObj } from "@storybook/react-vite";
import { Toaster } from "@webforge/editor-ui";
import { useEffect } from "react";
import { showUpdateReady } from "./update-ready.js";

/** Shows the notice as the window does once main says the update has downloaded. */
function UpdateReadyNotice({ version }: { readonly version: string }) {
  useEffect(() => showUpdateReady(version), [version]);
  return null;
}

const meta = {
  title: "Shell/Update ready",
  component: UpdateReadyNotice,
  parameters: { layout: "fullscreen" },
  args: { version: "1.2.0" },
} satisfies Meta<typeof UpdateReadyNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Webforge's update has downloaded (0.5a): it installs when Webforge closes. */
export const Ready: Story = {
  render: (args, { globals }) => (
    <div className="h-40">
      <Toaster theme={globals.theme === "light" ? "light" : "dark"} />
      <UpdateReadyNotice {...args} />
    </div>
  ),
};
