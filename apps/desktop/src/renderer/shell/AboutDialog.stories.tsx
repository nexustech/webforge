import type { Meta, StoryObj } from "@storybook/react-vite";
import { AboutDialogView } from "./AboutDialog.js";

// Help → About: the app's icon (#454), name and version, and the way to its licences (5.3).

const meta = {
  title: "Dialogs/About",
  component: AboutDialogView,
  tags: ["full-window"],
  args: {
    info: { name: "Webforge", version: "1.0.0" },
    open: true,
    onOpenChange: () => undefined,
    onShowLicences: () => undefined,
  },
} satisfies Meta<typeof AboutDialogView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The icon above the name and version. */
export const About: Story = {};
