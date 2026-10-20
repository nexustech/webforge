import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScrollArea } from "./scroll-area.js";

const meta = {
  title: "Base/ScrollArea",
  component: ScrollArea,
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

const STEPS = Array.from({ length: 30 }, (_, index) => `Edited Heading text ${index + 1}`);

export const UndoSteps: Story = {
  render: () => (
    <ScrollArea type="always" className="h-48 w-64 border border-border-strong bg-panel">
      <ol className="p-1">
        {STEPS.map((step) => (
          <li key={step} className="flex h-6 items-center px-2 text-xs">
            {step}
          </li>
        ))}
      </ol>
    </ScrollArea>
  ),
};
