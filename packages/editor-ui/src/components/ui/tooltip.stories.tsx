import type { Meta, StoryObj } from "@storybook/react-vite";
import { Undo2Icon } from "lucide-react";
import { Button } from "./button.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip.js";

const meta = {
  title: "Base/Tooltip",
  component: Tooltip,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  render: () => (
    <Tooltip open>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Undo">
          <Undo2Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
    </Tooltip>
  ),
};
