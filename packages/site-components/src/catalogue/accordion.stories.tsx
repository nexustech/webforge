import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = {
  title: "Site components/Accordion",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** An Accordion of a bakery's order details in a Section, under a Heading, one open at a time. */
export const Accordion: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          id: "section",
          contentWidth: "medium",
          content: [
            { type: "Heading", props: { id: "heading", text: "Before you order", size: "medium" } },
            {
              type: "Accordion",
              props: {
                id: "order",
                oneOpen: true,
                items: [
                  ["allergies", "Allergies", "Our cakes are made with nuts, eggs and milk."],
                  ["delivery", "Delivery", "We deliver within five miles of the shop."],
                  ["cancelling", "Cancelling", "Cancel up to two days before you collect."],
                ].map(([id, title, words]) => ({
                  type: "AccordionItem",
                  props: { id, title, text: `<p>${words}</p>` },
                })),
              },
            },
          ],
        },
      },
    ],
  },
};
