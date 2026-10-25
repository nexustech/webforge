import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = {
  title: "Site components/Logos",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Five places a bakery has been featured, each the stories' photo, the first two linked. */
const LOGOS = ["The Daily Loaf", "Town Radio", "Food Weekly", "City Guide", "Bake Off Club"].map(
  (name, index) => ({
    type: "Logo",
    props: {
      id: `logo-${index}`,
      image: { mediaId: "photo", alt: name },
      name,
      ...(index < 2 ? { link: { kind: "url", href: "https://example.com" } } : {}),
    },
  }),
);

/** The Logos section in `variant`. */
const logos = (variant: string): Story => ({
  args: {
    nodes: [
      {
        type: "Logos",
        props: { id: `logos-${variant}`, title: "As seen in", items: LOGOS, variant },
      },
    ],
  },
});

/** A row of logos that wraps. */
export const Row: Story = logos("row");

/** A grid of tiles, four to a row on a wide screen. */
export const Grid: Story = logos("grid");
