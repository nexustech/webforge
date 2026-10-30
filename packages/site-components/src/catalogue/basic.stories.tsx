import type { Meta, StoryObj } from "@storybook/react-vite";
import type { NodeDoc } from "@webforge/model";
import { SiteNodes } from "../stories/site-nodes.js";
import { siteLibrary } from "./index.js";

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

/** A Section with a Heading and Text, as a new page starts: Wide, as Features is (3.21). */
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

/** A Section at `contentWidth` on reversed colours, whose band still spans the page (3.21). */
const sectionAt = (contentWidth: string, title: string): Story => ({
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          id: "section",
          colors: "inverse",
          contentWidth,
          content: [heading("medium", title), text],
        },
      },
    ],
  },
});

/** Content width Narrow: 768 px, the text-led sections' reading width. */
export const SectionNarrow: Story = sectionAt("narrow", "Narrow");

/** Content width Medium: 896 px, as every Section was before 3.21. */
export const SectionMedium: Story = sectionAt("medium", "Medium");

/** Content width Wide: 1152 px, a new Section's, as Features and the other grids. */
export const SectionWide: Story = sectionAt("wide", "Wide");

/** Content width Full: the page's width less the section's padding. */
export const SectionFull: Story = sectionAt("full", "Full");

/** A new Section with a heading above a Features section: their content lines up (3.21, PF-4). */
export const SectionAboveFeatures: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          ...siteLibrary.components.Section?.defaults,
          id: "section",
          content: [heading("medium", "Rosa's Bakery, since 1987")],
        },
      },
      {
        type: "Features",
        props: { ...siteLibrary.components.Features?.defaults, id: "features" },
      },
    ],
  },
};

/** Full, more space between its elements, and its own padding per device. */
export const SectionStyled: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          id: "section",
          contentWidth: "full",
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
          contentWidth: "medium",
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
          contentWidth: "medium",
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
