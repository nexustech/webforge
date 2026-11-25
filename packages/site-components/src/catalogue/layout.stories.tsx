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

/** The Header split, the menu centred, with its own button on the right (2.6, HF-2). */
export const HeaderSplit: Story = {
  args: {
    nodes: header({
      variant: "split",
      button: true,
      buttonLabel: "Call us",
      buttonLink: { kind: "phone", number: "+44 1234 567890" },
    }),
    context: { href: () => "tel:+441234567890" },
  },
};

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

/** A Header that hides on the way down the page (HH-7), in view as the page opens. */
export const HeaderHides: Story = {
  args: { nodes: header({ sticky: true, scrollStyle: "hide" }) },
};

/** The same once the page has scrolled down: slid up out of view, until the visitor scrolls up. */
export const HeaderHidden: Story = {
  args: { nodes: header({ sticky: true, scrollStyle: "hide" }) },
  play: async ({ canvasElement }) => {
    // As the "sticky" behaviour marks it on the way down.
    canvasElement.querySelector("header.site-header")?.setAttribute("data-hidden", "");
  },
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

/** The Footer centred, with columns: its text under them, centred (#1368). */
export const FooterCentredColumns: Story = {
  args: {
    nodes: [
      {
        type: "Footer",
        props: {
          id: "footer",
          text: "© Rosa's Bakery, Hightown",
          variant: "centred",
          columns: [
            column("links", [
              { type: "Heading", props: { id: "links-title", text: "Explore", size: "small" } },
              { type: "MenuLinks", props: { id: "menu" } },
            ]),
            column("about", [
              {
                type: "Text",
                props: { id: "about-text", text: "<p>Fresh bread every morning since 1998.</p>" },
              },
            ]),
          ],
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

/**
 * A logo in a Footer column, Small as the Header's can be (HF-9), over the column's text, beside
 * the menu's links under a title.
 */
export const FooterLogo: Story = {
  args: {
    nodes: [
      {
        type: "Footer",
        props: {
          id: "footer",
          text: "© Rosa's Bakery, Hightown",
          variant: "columns",
          columns: [
            column("brand", [
              {
                type: "Image",
                props: { id: "logo", image: { mediaId: "logo" }, size: "small", alignment: "left" },
              },
              {
                type: "Text",
                props: {
                  id: "about",
                  text: "<p>Bread and cakes, baked on Mill Street since 1998.</p>",
                },
              },
            ]),
            column("links", [
              { type: "Heading", props: { id: "links-title", text: "Explore", size: "small" } },
              { type: "MenuLinks", props: { id: "menu" } },
            ]),
          ],
        },
      },
    ],
  },
};

/**
 * Menu links with a page of the menu left out and another added (HF-8): Book a table, the menu's
 * button, stays in the Header, and Privacy, not in the menu, is in the Footer.
 */
export const FooterMenuLinksChosen: Story = {
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
              {
                type: "MenuLinks",
                props: { id: "menu", leaveOut: ["book"], add: ["privacy"] },
              },
            ]),
          ],
        },
      },
    ],
  },
};

/**
 * The Footer's bottom line (HF-5): its © line under the columns over a rule, with a Privacy link of
 * its own at the other end.
 */
export const FooterBottomLine: Story = {
  args: {
    nodes: [
      {
        type: "Footer",
        props: {
          id: "footer",
          text: "© Rosa's Bakery, Hightown",
          variant: "columns",
          links: ["privacy"],
          columns: [
            column("links", [
              { type: "Heading", props: { id: "links-title", text: "Explore", size: "small" } },
              { type: "MenuLinks", props: { id: "menu" } },
            ]),
            column("follow", [
              { type: "Heading", props: { id: "follow-title", text: "Follow us", size: "small" } },
              { type: "SocialLinks", props: { id: "social" } },
            ]),
          ],
        },
      },
    ],
  },
};

/**
 * The Header, a section and the Footer at the same content width (HF-10): the Header's name, menu
 * and button, and the Footer's columns and bottom line, line up with the section's content, their
 * backgrounds still across the page.
 */
const alignedAt = (contentWidth: string): Story => ({
  args: {
    nodes: [
      ...header({ contentWidth, button: true, buttonLabel: "Order a cake" }),
      {
        type: "Section",
        props: {
          id: "section",
          contentWidth,
          content: [
            {
              type: "Heading",
              props: { id: "heading", text: "Fresh every morning", size: "medium" },
            },
            {
              type: "Text",
              props: { id: "text", text: "<p>Bread, cakes and pastries, baked in Hightown.</p>" },
            },
          ],
        },
      },
      {
        type: "Footer",
        props: {
          id: "footer",
          text: "© Rosa's Bakery, Hightown",
          variant: "columns",
          contentWidth,
          links: ["privacy"],
          columns: [
            column("links", [
              { type: "Heading", props: { id: "links-title", text: "Explore", size: "small" } },
              { type: "MenuLinks", props: { id: "menu" } },
            ]),
            column("about", [
              {
                type: "Text",
                props: { id: "about-text", text: "<p>Fresh bread every morning since 1998.</p>" },
              },
            ]),
          ],
        },
      },
    ],
  },
});

/** The Header and Footer at Narrow, over a Narrow section (HF-10). */
export const LayoutNarrow: Story = alignedAt("narrow");

/** The Header and Footer at Medium, over a Medium section (HF-10). */
export const LayoutMedium: Story = alignedAt("medium");

/** The Header and Footer at Wide, as every template starts them, over a Wide section (HF-10). */
export const LayoutWide: Story = alignedAt("wide");
