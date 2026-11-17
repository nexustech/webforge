import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = {
  title: "Site components/Share buttons",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Links that share a post, in its Blog's design, under its tags (6.17b): each carries the post's
 * address on the web, which a site with its web address has.
 */
export const ShareButtons: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          id: "post-end",
          contentWidth: "narrow",
          content: [{ type: "ShareButtons", props: { id: "share-buttons" } }],
        },
      },
    ],
    context: {
      item: () => undefined,
      pageAddress: "https://rosasbakery.co.uk/blog/spring-opening.html",
    },
  },
};
