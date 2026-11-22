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

/** A Footer column of `content`, with `id`. */
const column = (id: string, content: readonly Record<string, unknown>[]) => ({
  type: "FooterColumn",
  props: { id, content },
});

/** The Footer in columns: its text, and the site's menu as links beside it (2.6, 5.39). */
export const FooterColumns: Story = {
  args: {
    nodes: [
      {
        type: "Footer",
        props: {
          id: "footer",
          text: "© Rosa's Bakery, Hightown",
          variant: "columns",
          columns: [column("links", [{ type: "MenuLinks", props: { id: "menu" } }])],
        },
      },
    ],
  },
};

/**
 * The Footer as *Full* starts it (HF-4, 5.39): its text, then the menu's links, the business's
 * contact details, and its social links over a newsletter signup, in columns that stack on phones.
 */
export const FooterFull: Story = {
  args: {
    nodes: [
      {
        type: "Footer",
        props: {
          id: "footer",
          text: "© Rosa's Bakery, Hightown",
          variant: "columns",
          columns: [
            column("links", [
              { type: "Heading", props: { id: "links-title", text: "Explore", size: "small" } },
              { type: "MenuLinks", props: { id: "menu" } },
            ]),
            column("contact", [
              {
                type: "ContactDetails",
                props: {
                  id: "contact",
                  title: "Visit us",
                  text: "",
                  showHours: true,
                  showContact: true,
                },
              },
            ]),
            column("follow", [
              { type: "SocialLinks", props: { id: "social" } },
              {
                type: "Newsletter",
                props: {
                  id: "news",
                  title: "Fresh from the oven",
                  text: "<p>News of our seasonal bakes, once a month.</p>",
                  buttonLabel: "Sign up",
                },
              },
            ]),
          ],
        },
      },
    ],
  },
};
