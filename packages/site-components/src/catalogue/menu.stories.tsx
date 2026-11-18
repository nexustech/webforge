import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";
import { siteLibrary } from "./index.js";

const meta = {
  title: "Site components/Food and drink menu",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Breakfast and drinks, each under its heading, as the Add panel places it. */
export const Starter: Story = {
  args: {
    nodes: [
      {
        type: "Menu",
        props: { id: "menu", ...siteLibrary.components.Menu?.defaults },
      },
    ],
  },
};

/** A dish, its heading, name, price and description, in the Menu's list. */
const dish = (index: number, [heading, name, price, text]: readonly string[]) => ({
  type: "MenuItem",
  props: { id: `dish-${index}`, heading, name, price, description: `<p>${text}</p>` },
});

/**
 * A longer menu: a name long enough to wrap on Mobile, with the dots and the price on its last
 * line, a price that starts with a word, and a dish without a price, which has no dots.
 */
export const LongerMenu: Story = {
  args: {
    nodes: [
      {
        type: "Menu",
        props: {
          id: "menu",
          ...siteLibrary.components.Menu?.defaults,
          title: "Lunch, from 11:30",
          text: "<p>Ask us about allergies when you order.</p>",
          items: [
            ["Soups", "Soup of the day", "£6.50", "Made fresh each morning, with bread."],
            [
              "",
              "Roasted tomato and red pepper with basil oil",
              "£7.00",
              "With sourdough and salted butter.",
            ],
            ["Sandwiches", "Toasted sandwiches", "from £7.50", "Cheese and onion, or ham."],
            ["", "Sandwich of the week", "", "Ask at the counter, or look at the board."],
          ].map((row, index) => dish(index, row)),
        },
      },
    ],
  },
};

/** On the theme's reversed colours: the dots and the headings' rule in the text's colour. */
export const Reversed: Story = {
  args: {
    nodes: [
      {
        type: "Menu",
        props: { id: "menu", ...siteLibrary.components.Menu?.defaults, colors: "inverse" },
      },
    ],
  },
};
