import type { Meta, StoryObj } from "@storybook/react-vite";
import type { NodeDoc } from "@webforge/model";
import { userEvent, within } from "storybook/test";
import { SiteNodes } from "../stories/site-nodes.js";
import { siteLibrary } from "./index.js";

// The Appearance group on each family (2.22, ST-1, ST-2): a section's title underlined in
// capitals over a surface with a border, corners and a shadow, and elements with colours, corners
// and borders of their own. Every value a theme token, so each preset restyles it.

const meta = {
  title: "Site components/Appearance",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A section's Appearance: its title underlined in capitals, on a darker surface, framed. */
const SECTION_LOOK = {
  lookUnderline: true,
  lookCase: "uppercase",
  lookBackground: "base-200",
  lookCorners: "large",
  lookBorder: "thin",
  lookBorderColor: "primary",
  lookShadow: "medium",
} as const;

/** An element's Appearance: its own colour, surface, corners and border. */
const ELEMENT_LOOK = {
  lookColor: "primary",
  lookBackground: "base-200",
  lookCorners: "medium",
  lookBorder: "thick",
  lookBorderColor: "accent",
  lookShadow: "small",
} as const;

/** `type` with its defaults, then `props`. */
function node(type: string, props: Readonly<Record<string, unknown>>): NodeDoc {
  return {
    type,
    props: { ...structuredClone(siteLibrary.components[type]?.defaults ?? {}), id: type, ...props },
  };
}

/** The section `type` with the section's Appearance. */
const section = (type: string, props: Readonly<Record<string, unknown>> = {}): Story => ({
  args: { nodes: [node(type, { ...SECTION_LOOK, ...props })] },
});

/** A Section holding `elements`. */
const holding = (elements: readonly NodeDoc[]): Story => ({
  args: { nodes: [{ type: "Section", props: { id: "band", content: [...elements] } }] },
});

/** Basic: a Section's title and its own Heading and Text, each with a look of its own. */
export const Basic: Story = holding([
  node("Heading", { text: "Fresh bread every morning", lookUnderline: true, lookAlign: "centre" }),
  node("Text", { ...ELEMENT_LOOK, lookItalic: true }),
]);

/**
 * Fonts (3.22, PF-5): a Heading and Text in their own fonts, then each set to the theme's Body,
 * Headings and Accent font; a theme's Accent is its Headings' until someone picks one.
 */
export const Fonts: Story = holding([
  node("Heading", { text: "Fresh bread every morning" }),
  node("Heading", { text: "Set in the body text's font", lookFont: "body" }),
  node("Text", { text: "<p>Set in the headings' font</p>", lookFont: "heading" }),
  node("Text", { text: "<p>Set in the accent font</p>", lookFont: "accent" }),
]);

/** Elements: a Button and an Icon, each with the hover row (ST-2). */
export const Elements: Story = holding([
  node("Button", { label: "Book a table", ...ELEMENT_LOOK, hover: "darken" }),
  node("Icon", { ...ELEMENT_LOOK, lookCorners: "full", hover: "grow" }),
  node("List", { lookWeight: "bold", lookColor: "secondary" }),
]);

/**
 * A Button with a background of its own, hovered: it darkens, as its own colours would have (2.22b),
 * though its hover row is left at None.
 */
export const ColouredButtonHovered: Story = {
  ...holding([node("Button", { label: "Book a table", lookBackground: "primary-300" })]),
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole("link", { name: "Book a table" }));
  },
};

/**
 * An Outline Button with a text colour of its own, hovered: it stays unfilled and darkens, so its
 * label stays readable; daisyUI would fill it with the colour its label is in (2.22b).
 */
export const ColouredOutlineHovered: Story = {
  ...holding([node("Button", { label: "Book a table", style: "outline", lookColor: "primary" })]),
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole("link", { name: "Book a table" }));
  },
};

/**
 * A Button that lifts with a shadow when hovered, slowly and springily (2.28, ST-7), hovered. The
 * screenshots are taken for a visitor who prefers less motion: the shadow shows, and it doesn't
 * move. Storybook shows it lift.
 */
export const LiftedButtonHovered: Story = {
  ...holding([
    node("Button", {
      label: "Book a table",
      hover: "liftShadow",
      hoverSpeed: "slow",
      hoverEasing: "springy",
    }),
  ]),
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole("link", { name: "Book a table" }));
  },
};

/**
 * Features whose cards tilt when hovered, at Medium speed (2.28, ST-7), the first one hovered. The
 * screenshots, taken for a visitor who prefers less motion, show it still; Storybook shows it tilt.
 */
export const TiltedCardHovered: Story = {
  args: { nodes: [node("Features", { variant: "cards", hover: "tilt", hoverSpeed: "medium" })] },
  play: async ({ canvasElement }) => {
    // Its title: the pointer over it is over the card.
    const [title] = within(canvasElement).getAllByText("A good reason");
    if (title !== undefined) await userEvent.hover(title);
  },
};

/** Sections: a Hero, its title underlined in capitals. */
export const Sections: Story = section("Hero");

export const Carousel: Story = section("Carousel");
export const Commerce: Story = holding([node("BuyButton", { ...ELEMENT_LOOK })]);
export const ContactDetails: Story = section("ContactDetails");
export const CustomCode: Story = holding([
  node("CustomCode", { ...ELEMENT_LOOK, html: "<p>Open every day from eight.</p>" }),
]);
export const Embeds: Story = section("Video");

/** Features: its cards darken when hovered (ST-2). */
export const Features: Story = section("Features", { hover: "darken" });
export const Forms: Story = section("Newsletter");
export const Gallery: Story = section("Gallery");
export const Logos: Story = section("Logos");

/** Pricing: its plans underline when hovered (ST-2). */
export const Pricing: Story = section("Pricing", { hover: "underline" });
export const Stats: Story = section("Stats");
export const Tabs: Story = holding([node("Tabs", { ...ELEMENT_LOOK })]);
export const Team: Story = section("Team", { hover: "shadow" });
export const Testimonials: Story = section("Testimonials", { lookOpacity: "90" });
