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
