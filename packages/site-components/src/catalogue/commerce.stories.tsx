import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";
import { siteLibrary } from "./index.js";

const meta = {
  title: "Site components/Commerce",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A Buy button in a Section, under a Heading: its price, and a link to its payment page. */
export const BuyButton: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          id: "section",
          ...siteLibrary.components.Section?.defaults,
          content: [
            {
              type: "Heading",
              props: { id: "heading", text: "Lemon drizzle cake", size: "medium" },
            },
            {
              type: "BuyButton",
              props: {
                id: "buy",
                ...siteLibrary.components.BuyButton?.defaults,
                price: "£24, serves 10",
                link: "https://buy.stripe.com/test_00abc",
              },
            },
          ],
        },
      },
    ],
  },
};

/** Centred, before its payment link is added: its button goes nowhere yet. */
export const BuyButtonWithoutLink: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          id: "section",
          ...siteLibrary.components.Section?.defaults,
          content: [
            {
              type: "BuyButton",
              props: {
                id: "buy",
                ...siteLibrary.components.BuyButton?.defaults,
                alignment: "centre",
              },
            },
          ],
        },
      },
    ],
  },
};
