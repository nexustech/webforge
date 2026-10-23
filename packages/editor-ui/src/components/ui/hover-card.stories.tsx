import type { Meta, StoryObj } from "@storybook/react-vite";
import { PlusIcon } from "lucide-react";
import { Button } from "./button.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card.js";

const meta = {
  title: "Base/HoverCard",
  component: HoverCard,
  parameters: { layout: "centered" },
} satisfies Meta<typeof HoverCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** More about the item the pointer rests on: a larger preview of a section to add. */
export const Open: Story = {
  render: () => (
    <HoverCard open>
      <HoverCardTrigger asChild>
        <Button size="sm" variant="outline">
          <PlusIcon aria-hidden />
          Hero
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-64">
        <p className="m-0 text-xs">A large heading, a line of text and a button.</p>
      </HoverCardContent>
    </HoverCard>
  ),
};
