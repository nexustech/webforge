import type { Meta, StoryObj } from "@storybook/react-vite";
import type { NodeDoc } from "@webforge/model";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = {
  title: "Site components/Basic",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

const heading = (size: string, text: string): NodeDoc => ({
  type: "Heading",
  props: { id: `heading-${size}`, text, size },
});
const text: NodeDoc = {
  type: "Text",
  props: {
    id: "text",
    text: "<p>Sourdough, cakes and pastries, baked every morning in Hightown.</p><p>Come early: the cinnamon buns go first.</p>",
  },
};

/** A Section with a Heading and Text, as a new page starts. */
export const Section: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: { id: "section", content: [heading("large", "Welcome to Rosa's Bakery"), text] },
      },
    ],
  },
};

/** Full width, more space between its elements, and its own padding per device. */
export const SectionStyled: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          id: "section",
          fullWidth: true,
          gap: "large",
          padding: { $responsive: { desktop: { top: "xl", bottom: "xl" }, mobile: { top: "s" } } },
          content: [heading("medium", "Our story"), text],
        },
      },
    ],
  },
};

/**
 * The three heading sizes. The theme colours aren't shown: some themes' primary colour is too
 * light for text on their background (cupcake's), which 2.3's contrast checks will cover.
 */
export const Headings: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          id: "section",
          content: [
            heading("large", "Large heading"),
            heading("medium", "Medium heading"),
            heading("small", "Small heading"),
          ],
        },
      },
    ],
  },
};

/**
 * Lists in rich text, with their bullets and numbers (#388), above a List element set to no
 * markers, which keeps its own style.
 */
export const TextWithLists: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          id: "section",
          content: [
            {
              type: "Text",
              props: {
                id: "lists",
                text: "<p>What we bake every day:</p><ul><li>Sourdough</li><li>Cinnamon buns</li></ul><p>How to order a cake:</p><ol><li>Choose a size</li><li>Tell us the message</li></ol>",
              },
            },
            {
              type: "List",
              props: {
                id: "plain-list",
                style: "plain",
                items: ["Open from 7am", "Closed on Mondays"].map((item, index) => ({
                  type: "ListItem",
                  props: { id: `plain-${index}`, text: item },
                })),
              },
            },
          ],
        },
      },
    ],
  },
};
