import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";
import { siteLibrary } from "./index.js";

const meta = {
  title: "Site components/Latest posts",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The Latest posts as it starts. Add a story for each of its layouts. */
export const LatestPosts: Story = {
  args: {
    nodes: [
      {
        type: "LatestPosts",
        props: { id: "latest-posts", ...siteLibrary.components.LatestPosts?.defaults },
      },
    ],
  },
};
