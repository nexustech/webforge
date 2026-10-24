import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = {
  title: "Site components/Gallery",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

const CAPTIONS = [
  "Sourdough loaves",
  "The oven at dawn",
  "Birthday cakes",
  "Our counter",
  "Cinnamon buns",
  "The shop window",
];

/** A Gallery of six images in `variant`'s layout, captions under the first three. */
const gallery = (variant: string) => [
  {
    type: "Gallery",
    props: {
      id: `gallery-${variant}`,
      title: "Our work",
      variant,
      images: CAPTIONS.map((alt, index) => ({
        type: "GalleryImage",
        props: {
          id: `image-${index + 1}`,
          image: { mediaId: "photo", alt },
          caption: index < 3 ? alt : "",
        },
      })),
    },
  },
];

/** Square crops in a grid (2.7a). Each image opens larger in the lightbox. */
export const Grid: Story = { args: { nodes: gallery("grid") } };

/** Each image its own shape, in columns (2.7a). */
export const Masonry: Story = { args: { nodes: gallery("masonry") } };

/** The first image large, the rest beside and under it (2.7a). */
export const Featured: Story = { args: { nodes: gallery("featured") } };
