import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";
import { siteLibrary } from "./index.js";

const meta = {
  title: "Site components/Steps",
  component: SiteNodes,
  // Side by side from Tablet up, one under another on Mobile: checked at all three.
  tags: ["tablet"],
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Three numbered steps, as the Add panel places them. */
export const Numbered: Story = {
  args: {
    nodes: [
      {
        type: "Steps",
        props: { id: "steps", ...siteLibrary.components.Steps?.defaults },
      },
    ],
  },
};

/** Four steps along a line, each with its date. */
export const Timeline: Story = {
  args: {
    nodes: [
      {
        type: "Steps",
        props: {
          id: "steps",
          ...siteLibrary.components.Steps?.defaults,
          variant: "timeline",
          title: "Your new kitchen",
          text: "<p>From the first visit to the finished room, in about six weeks.</p>",
          items: [
            ["Week 1", "We visit", "We measure up and talk through what you'd like."],
            ["Week 2", "Your design", "You get drawings and a fixed price to approve."],
            ["Weeks 3–5", "We fit it", "Our team fits everything, tidying up each day."],
            ["Week 6", "Finished", "We walk you round it and hand over the guarantees."],
          ].map(([date, title, text], index) => ({
            type: "Step",
            props: { id: `step-${index}`, date, title, text: `<p>${text}</p>` },
          })),
        },
      },
    ],
  },
};
