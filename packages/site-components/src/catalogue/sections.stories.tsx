import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = {
  title: "Site components/Sections",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

const hero = (alignment: string, props: Record<string, unknown> = {}) => ({
  type: "Hero",
  props: {
    id: `hero-${alignment}`,
    title: "Baked fresh every morning",
    text: "Sourdough, cakes and pastries from our oven to your table.",
    buttonLabel: "See the menu",
    buttonLink: { kind: "url", href: "https://example.com" },
    alignment,
    image: { mediaId: "photo" },
    ...props,
  },
});

/** The Hero, centred, with its image. */
export const Hero: Story = { args: { nodes: [hero("centre")] } };

/** The Hero aligned to the left. */
export const HeroLeft: Story = { args: { nodes: [hero("left")] } };

/** The Hero centred, its image below the text (2.6). */
export const HeroCentred: Story = { args: { nodes: [hero("centre", { variant: "centred" })] } };

/** The Hero's text over its image, which fills the section (2.6). */
export const HeroBackground: Story = {
  args: { nodes: [hero("left", { variant: "background" })] },
};

/** The Hero with text only (2.6). */
export const HeroMinimal: Story = { args: { nodes: [hero("centre", { variant: "minimal" })] } };

/** A Text section: a title and formatted text (2.6). */
export const Text: Story = {
  args: {
    nodes: [
      {
        type: "TextSection",
        props: {
          id: "story",
          title: "Our story",
          text: '<p>Rosa opened the bakery in 1998 with one oven and a sourdough starter from her grandmother.</p><p>Today we bake every morning from 4am, and <a href="https://example.com">sell at the market</a> on Saturdays.</p>',
        },
      },
    ],
  },
};

/** A Text section over a background image, under a strong layer of the page background (2.26). */
export const TextBackground: Story = {
  args: {
    nodes: [
      {
        type: "TextSection",
        props: {
          id: "story-background",
          title: "Our story",
          text: "<p>Rosa opened the bakery in 1998 with one oven and a sourdough starter from her grandmother.</p>",
          backgroundImage: { mediaId: "photo" },
          overlay: "60",
        },
      },
    ],
  },
};

/** A Call to action over a background image, under the theme's neutral colour, very strong (2.26). */
export const CallToActionBackground: Story = {
  args: {
    nodes: [
      {
        type: "CallToAction",
        props: {
          id: "cta-background",
          title: "Order a cake",
          text: "Tell us what you'd like two days ahead, and we'll have it ready.",
          buttonLabel: "Get in touch",
          buttonLink: { kind: "url", href: "https://example.com" },
          backgroundImage: { mediaId: "photo" },
          overlay: "80",
          overlayColor: "neutral",
        },
      },
    ],
  },
};

const textImage = (variant: string) => ({
  type: "TextImage",
  props: {
    id: `text-image-${variant}`,
    title: "What we bake",
    text: "<p>Sourdough, rye and seeded loaves; cakes to order with two days' notice.</p>",
    image: { mediaId: "photo", alt: "Loaves cooling on a rack" },
    variant,
  },
});

/** Text + Image, the image on the right (2.6). */
export const TextImageRight: Story = { args: { nodes: [textImage("imageRight")] } };

/** Text + Image, the image on the left (2.6). */
export const TextImageLeft: Story = { args: { nodes: [textImage("imageLeft")] } };

const callToAction = (variant: string) => ({
  type: "CallToAction",
  props: {
    id: `cta-${variant}`,
    title: "Order a cake",
    text: "Tell us what you'd like two days ahead, and we'll have it ready.",
    buttonLabel: "Get in touch",
    buttonLink: { kind: "url", href: "https://example.com" },
    variant,
  },
});

/** A Call to action as a banner in the theme's main colour (2.6). */
export const CallToActionBanner: Story = { args: { nodes: [callToAction("banner")] } };

/** A Call to action with its button beside the text (2.6). */
export const CallToActionSplit: Story = { args: { nodes: [callToAction("split")] } };

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

/** An FAQ of four questions in `variant`. */
const faq = (variant: string): Story => ({
  args: {
    nodes: [
      {
        type: "Faq",
        props: {
          id: `faq-${variant}`,
          title: "Questions",
          variant,
          items: (
            [
              ["Are you open on Sundays?", "Yes, 8 to 2."],
              ["Do you bake gluten-free?", "Every Friday, in a kitchen of its own."],
              ["Can I order a birthday cake?", "Yes: give us three days and we'll write any name."],
              ["Is there parking?", "Two spaces behind the shop, and a car park across the road."],
            ] as const
          ).map(([question, answer], index) => ({
            type: "FaqItem",
            props: { id: `faq-${variant}-${index}`, question, answer: `<p>${answer}</p>` },
          })),
        },
      },
    ],
  },
});

/** An FAQ in two columns of questions that open. */
export const FaqColumns: Story = faq("columns");

/** An FAQ with every answer shown below its question. */
export const FaqOpen: Story = faq("open");
