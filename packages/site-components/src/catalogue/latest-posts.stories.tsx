import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";
import { siteLibrary } from "./index.js";

const meta = {
  title: "Site components/Latest posts",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

const latest = (props: Record<string, unknown>) => ({
  type: "LatestPosts",
  props: { id: "latest-posts", ...siteLibrary.components.LatestPosts?.defaults, ...props },
});

/** The Blog's three newest posts as cards, with a link to all of them (6.10b). */
export const LatestPosts: Story = { args: { nodes: [latest({})] } };

/** Six posts as a list of titles and dates, without summaries. */
export const List: Story = {
  args: { nodes: [latest({ variant: "list", count: "6", showSummary: false })] },
};

/** One of the Blog's own pages, as the export writes it: its posts, with a link to newer ones. */
export const BlogPage: Story = {
  args: { nodes: [latest({ title: "Blog", page: 1, collection: "blog" })] },
};
