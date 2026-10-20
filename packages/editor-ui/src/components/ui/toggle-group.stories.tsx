import type { Meta, StoryObj } from "@storybook/react-vite";
import { MonitorIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group.js";

const meta = {
  title: "Base/ToggleGroup",
  component: ToggleGroup,
  args: { type: "single" },
} satisfies Meta<typeof ToggleGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DeviceViews: Story = {
  render: () => (
    <ToggleGroup type="single" defaultValue="desktop" aria-label="Device view">
      <ToggleGroupItem value="desktop" aria-label="Desktop">
        <MonitorIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="tablet" aria-label="Tablet">
        <TabletIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="mobile" aria-label="Mobile">
        <SmartphoneIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Modes: Story = {
  render: () => (
    <ToggleGroup type="single" defaultValue="design" aria-label="Mode">
      <ToggleGroupItem value="design">Design</ToggleGroupItem>
      <ToggleGroupItem value="content">Content</ToggleGroupItem>
      <ToggleGroupItem value="locked" disabled>
        Locked
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};
