import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";
import { siteLibrary } from "./index.js";

const meta = {
  title: "Site components/Embeds",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

// The placeholders as a page shows them before the visitor clicks: the button appears with the
// embed behaviour, which stories don't run, so the link to the provider shows alone.

/** A YouTube video under its title and text. */
export const Video: Story = {
  args: {
    nodes: [
      {
        type: "Video",
        props: {
          id: "video",
          ...siteLibrary.components.Video?.defaults,
          address: "https://youtu.be/aqz-KE-bpKQ",
        },
      },
    ],
  },
};

/** A Vimeo video beside its title and text. */
export const VideoBesideText: Story = {
  args: {
    nodes: [
      {
        type: "Video",
        props: {
          id: "video",
          ...siteLibrary.components.Video?.defaults,
          address: "https://vimeo.com/76979871",
          variant: "split",
        },
      },
    ],
  },
};

/** A map of an address beside its title and text. */
export const MapBesideText: Story = {
  args: {
    nodes: [
      {
        type: "Map",
        props: {
          id: "map",
          ...siteLibrary.components.Map?.defaults,
          address: "1 High Street\nHightown\nHT1 2AB",
          variant: "split",
        },
      },
    ],
  },
};

/** An Embed video element in a Section, under a Heading and Text (2.11). */
export const EmbedVideoElement: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          id: "section",
          ...siteLibrary.components.Section?.defaults,
          content: [
            { type: "Heading", props: { id: "heading", text: "Our oven at work", size: "medium" } },
            {
              type: "Text",
              props: { id: "text", text: "<p>Every loaf, from the dough to the shelf.</p>" },
            },
            {
              type: "EmbedVideo",
              props: {
                id: "video",
                address: "https://youtu.be/aqz-KE-bpKQ",
                name: "Our oven at work",
              },
            },
          ],
        },
      },
    ],
  },
};

/** An Embed map element in a Section, under a Heading (2.11). */
export const EmbedMapElement: Story = {
  args: {
    nodes: [
      {
        type: "Section",
        props: {
          id: "section",
          ...siteLibrary.components.Section?.defaults,
          content: [
            { type: "Heading", props: { id: "heading", text: "Find us", size: "medium" } },
            {
              type: "EmbedMap",
              props: { id: "map", address: "1 High Street\nHightown\nHT1 2AB", name: "Our bakery" },
            },
          ],
        },
      },
    ],
  },
};
