import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = {
  title: "Site components/Sections",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

const hero = (alignment: string) => ({
  type: "Hero",
  props: {
    id: `hero-${alignment}`,
    title: "Baked fresh every morning",
    text: "Sourdough, cakes and pastries from our oven to your table.",
    buttonLabel: "See the menu",
    buttonLink: { kind: "url", href: "https://example.com" },
    alignment,
    image: { mediaId: "photo" },
  },
});

/** The Hero, centred, with its image. */
export const Hero: Story = { args: { nodes: [hero("centre")] } };

/** The Hero aligned to the left. */
export const HeroLeft: Story = { args: { nodes: [hero("left")] } };

/** An FAQ: each question opens with the keyboard or a click, without JavaScript. */
export const Faq: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          id: "section",
          content: [],
        },
      },
      {
        type: "Faq",
        props: {
          id: "faq",
          title: "Questions",
          items: [
            {
              type: "FaqItem",
              props: {
                id: "q1",
                question: "Are you open on Sundays?",
                answer: "<p>Yes, 8 to 2.</p>",
              },
            },
            {
              type: "FaqItem",
              props: {
                id: "q2",
                question: "Do you bake gluten-free?",
                answer: "<p>Every Friday.</p>",
              },
            },
          ],
        },
      },
    ],
  },
};
