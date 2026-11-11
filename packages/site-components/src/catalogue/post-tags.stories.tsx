import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = {
  title: "Site components/Post tags",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A post's tags in its Blog's design, each a link to the page listing its posts (6.10b). */
export const PostTags: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          id: "post-end",
          contentWidth: "narrow",
          content: [{ type: "PostTags", props: { id: "post-tags" } }],
        },
      },
    ],
    context: {
      item: (field) =>
        field === "tags"
          ? {
              kind: "tags",
              tags: [
                { name: "News", path: "blog/tag/news" },
                { name: "Opening times", path: "blog/tag/opening-times" },
                { name: "Bread", path: "blog/tag/bread" },
              ],
            }
          : undefined,
    },
  },
};
