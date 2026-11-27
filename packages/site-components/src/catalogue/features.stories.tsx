import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";
import { siteLibrary } from "./index.js";

const meta = {
  title: "Site components/Features",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The Features section in `variant`, with its starter features. */
const features = (variant: string): Story => ({
  args: {
    nodes: [
      {
        type: "Features",
        props: { id: `features-${variant}`, ...siteLibrary.components.Features?.defaults, variant },
      },
    ],
  },
});

/** Cards, three to a row. */
export const Cards: Story = features("cards");

/** Centred icons, each with its text below. */
export const CentredIcons: Story = features("centred");

/** A list in two columns, each icon beside its text. */
export const List: Story = features("list");

/** Four features in rows of three: the fourth is centred under the others (#1372). */
export const FourCards: Story = {
  args: {
    nodes: [
      {
        type: "Features",
        props: {
          id: "features-four",
          ...siteLibrary.components.Features?.defaults,
          variant: "cards",
          items: ["sparkles", "heart-handshake", "clock", "leaf"].map((icon, index) => ({
            type: "Feature",
            props: {
              id: `feature-four-${index}`,
              icon,
              title: ["Made fresh", "Friendly staff", "Open early", "Local flour"][index],
              text: "<p>A few words about why it matters.</p>",
            },
          })),
        },
      },
    ],
  },
};

/** Texts of three lengths, so cards side by side would differ in height. */
const TEXTS = [
  "<p>Fresh every day.</p>",
  "<p>Baked before dawn from flour milled down the road, with butter from the farm next door and nothing else added.</p>",
  "<p>Cakes for birthdays and weddings, made to order.</p>",
];

/** Features' cards layout with `count` cards of texts of different lengths, and `cardHeight`. */
const cards = (count: number, cardHeight?: string) => ({
  type: "Features",
  props: {
    id: `features-${count}-${cardHeight ?? "unset"}`,
    ...siteLibrary.components.Features?.defaults,
    variant: "cards",
    ...(cardHeight === undefined ? {} : { cardHeight }),
    title: `${count} ${count === 1 ? "card" : "cards"}`,
    items: Array.from({ length: count }, (_, index) => ({
      type: "Feature",
      props: {
        id: `feature-${count}-${cardHeight ?? "unset"}-${index}`,
        icon: "sparkles",
        title: `Card ${index + 1}`,
        text: TEXTS[index % TEXTS.length],
      },
    })),
  },
});

/**
 * Card height's Same height, the default (#1511): every card as tall as the tallest, on every
 * row, the fourth still centred under the others.
 */
export const SameHeightEveryRow: Story = { args: { nodes: [cards(4, "same")] } };

/** Card height's Fit the text (#1511): each card as tall as its own text. */
export const FitTheText: Story = { args: { nodes: [cards(4, "fit")] } };

/**
 * One to seven cards, Same height (#1511): each last row that isn't full centred, by the grid's
 * rules that count the cards, and every row alike.
 */
export const EveryCount: Story = {
  args: { nodes: [1, 2, 3, 4, 5, 6, 7].map((count) => cards(count)) },
};
