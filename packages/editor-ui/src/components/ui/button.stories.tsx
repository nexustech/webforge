import type { Meta, StoryObj } from "@storybook/react-vite";
import { CloudUploadIcon, DownloadIcon, EyeIcon, FolderOpenIcon, Undo2Icon } from "lucide-react";
import { Button } from "./button.js";

const meta = {
  title: "Base/Button",
  component: Button,
  args: { children: "Button" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Delete</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="icon" variant="ghost" aria-label="Undo">
        <Undo2Icon />
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="Undo">
        <Undo2Icon />
      </Button>
    </div>
  ),
};

export const Disabled: Story = { args: { disabled: true } };

/** The colour-coded title-bar actions (UI1): tinted icons, white labels. */
export const TitleBarActions: Story = {
  render: () => (
    <div className="flex items-center gap-1 bg-titlebar p-1">
      <Button variant="ghost">
        <FolderOpenIcon className="text-warning" />
        Open
      </Button>
      <Button variant="ghost">
        <EyeIcon className="text-info" />
        Preview
      </Button>
      <Button variant="ghost">
        <DownloadIcon className="text-success" />
        Export
      </Button>
      <Button variant="ghost">
        <CloudUploadIcon className="text-publish" />
        Publish
      </Button>
    </div>
  ),
};
