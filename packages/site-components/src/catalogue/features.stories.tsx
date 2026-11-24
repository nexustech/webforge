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
