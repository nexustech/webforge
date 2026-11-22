import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = {
  title: "Site components/Layout",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The Header, with `props` over its own: the site's name from Site Settings. */
const header = (props: Record<string, unknown> = {}) => [
  {
    type: "Header",
    props: {
      id: "header",
      siteName: "Rosa's Bakery",
      bindings: { siteName: "general.name" },
      ...props,
    },
  },
];

/** The shared Header: the site's name left and its navigation right, a button among the links. */
export const Header: Story = { args: { nodes: header() } };

/** The Header centred, its navigation under the site's name (2.6). */
export const HeaderCentred: Story = { args: { nodes: header({ variant: "centred" }) } };

/** The Header split: the menu's last link as a button on the right (2.6). */
export const HeaderSplit: Story = { args: { nodes: header({ variant: "split" }) } };

/** The Header with the logo from Site Settings in place of the site's name (HF-1). */
export const HeaderLogo: Story = {
  args: { nodes: header({ logoPlace: "instead", logoSize: "medium" }), context: { logo: "logo" } },
};

/** The Header centred, the logo large beside the site's name (HF-1). */
export const HeaderLogoBeside: Story = {
  args: {
    nodes: header({ variant: "centred", logoPlace: "beside", logoSize: "large" }),
    context: { logo: "logo" },
  },
};

/** A sticky Header (F-DS-6), as it is before the page scrolls: its shadow comes once it has. */
export const HeaderSticky: Story = {
  args: { nodes: header({ sticky: true, scrollStyle: "shadow" }) },
};

/** The shared Footer, its text centred. */
export const Footer: Story = {
  args: {
    nodes: [{ type: "Footer", props: { id: "footer", text: "© Rosa's Bakery, Hightown" } }],
  },
};

/** The Footer in columns: its text, and the site's menu as links beside it (2.6). */
export const FooterColumns: Story = {
  args: {
    nodes: [
      {
        type: "Footer",
        props: { id: "footer", text: "© Rosa's Bakery, Hightown", variant: "columns" },
      },
    ],
  },
};
