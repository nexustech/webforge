import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = {
  title: "Site components/Testimonials",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Three customers, each with the stories' photo. */
const ITEMS = [
  {
    quote: "The best sourdough in town, and they always remember our order.",
    name: "Priya Shah",
    role: "Regular customer",
  },
  {
    quote: "They fixed our boiler on a Sunday morning and were back to check on Monday.",
    name: "Tom Ellis",
    role: "Hightown",
  },
  {
    quote: "Friendly, quick and good value. We'll be back.",
    name: "Ana Costa",
    role: "Owner, Costa Florists",
  },
].map((item, index) => ({
  type: "Testimonial",
  props: { id: `testimonial-${index}`, ...item, photo: { mediaId: "photo" } },
}));

/** The Testimonials section in `variant`. */
const testimonials = (variant: string): Story => ({
  args: {
    nodes: [
      {
        type: "Testimonials",
        props: {
          id: `testimonials-${variant}`,
          title: "What our customers say",
          items: ITEMS,
          variant,
        },
      },
    ],
  },
});

/** Cards, three to a row. */
export const Cards: Story = testimonials("cards");

/** Large quotes, one under another. */
export const LargeQuotes: Story = testimonials("large");

/** Each photo beside its quote, two to a row. */
export const PhotoBesideEachQuote: Story = testimonials("photos");
