import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = {
  title: "Site components/Layout",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The shared Header: the site's name and its navigation, a button among the links. */
export const Header: Story = {
  args: {
    nodes: [
      {
        type: "Header",
        props: { id: "header", siteName: "Rosa's Bakery", bindings: { siteName: "general.name" } },
      },
    ],
  },
};

/** The shared Footer. */
export const Footer: Story = {
  args: {
    nodes: [{ type: "Footer", props: { id: "footer", text: "© Rosa's Bakery, Hightown" } }],
  },
};
