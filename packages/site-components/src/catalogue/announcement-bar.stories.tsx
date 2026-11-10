import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";
import { siteLibrary } from "./index.js";

const meta = {
  title: "Site components/Announcement bar",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

const defaults = siteLibrary.components.AnnouncementBar?.defaults;

/** The Announcement bar as the Add panel places it, above the Header (6.4). */
export const AnnouncementBar: Story = {
  args: {
    nodes: [
      { type: "AnnouncementBar", props: { id: "announcement-bar", ...defaults } },
      { type: "Header", props: { id: "header", ...siteLibrary.components.Header?.defaults } },
    ],
  },
};

/** With a link on its text, and a longer line that wraps on a phone. */
export const WithLink: Story = {
  args: {
    nodes: [
      {
        type: "AnnouncementBar",
        props: {
          id: "announcement-bar",
          ...defaults,
          text: "New: order birthday cakes online, collected from the shop on the day",
          link: { kind: "url", href: "https://rosas.example/cakes" },
        },
      },
    ],
  },
};
