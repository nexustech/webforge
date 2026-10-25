import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = {
  title: "Site components/Stats",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A plumber's numbers. */
const STATS = [
  { number: "22", label: "years in business" },
  { number: "3,000+", label: "boilers fitted" },
  { number: "4.9", label: "average review" },
  { number: "24/7", label: "emergency call-outs" },
].map((stat, index) => ({ type: "Stat", props: { id: `stat-${index}`, ...stat } }));

/** The Stats section in `variant`. */
const stats = (variant: string): Story => ({
  args: {
    nodes: [
      {
        type: "Stats",
        props: {
          id: `stats-${variant}`,
          title: "In numbers",
          text: "<p>Local, qualified and here when you need us.</p>",
          items: STATS,
          variant,
        },
      },
    ],
  },
});

/** The stats in a row below the title. */
export const Row: Story = stats("row");

/** Each stat on a card of its own. */
export const Cards: Story = stats("cards");

/** The stats beside the title and introduction. */
export const BesideTheText: Story = stats("split");
