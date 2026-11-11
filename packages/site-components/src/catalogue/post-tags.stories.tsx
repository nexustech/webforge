import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";
import { siteLibrary } from "./index.js";

const meta = {
  title: "Site components/Post tags",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The Post tags as it starts. Add a story for each of its layouts. */
export const PostTags: Story = {
  args: {
    nodes: [
      {
        type: "PostTags",
        props: { id: "post-tags", ...siteLibrary.components.PostTags?.defaults },
      },
    ],
  },
};
