import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./button.js";
import { TourCard } from "./tour-card.js";

const noop = () => undefined;

const actions = (
  <>
    <Button variant="ghost" size="sm" className="mr-auto">
      Skip tour
    </Button>
    <Button variant="outline" size="sm">
      Back
    </Button>
    <Button size="sm">Next</Button>
  </>
);

const meta = {
  title: "Base/TourCard",
  component: TourCard,
  args: {
    title: "See it as visitors will",
    step: "Step 2 of 3",
    onEscape: noop,
    actions,
    children: (
      <>
        <p className="m-0">Preview shows your site in your browser, and on your phone.</p>
        <Button variant="link" size="sm" className="self-start px-0">
          Learn more about Preview
        </Button>
      </>
    ),
  },
} satisfies Meta<typeof TourCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** With nothing to point at: centred in the window, as the last card and the offer are. */
export const Centred: Story = {};

/** Beside the control it's about: below a button near the window's top right. */
export const BesideAControl: Story = {
  render: function Render(args) {
    const [button, setButton] = useState<HTMLButtonElement | null>(null);
    return (
      <div className="flex justify-end p-2">
        <Button ref={setButton}>Preview</Button>
        {button === null ? null : (
          <TourCard {...args} anchor={() => button.getBoundingClientRect()} />
        )}
      </div>
    );
  },
};
