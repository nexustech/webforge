import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = {
  title: "Site components/Carousel",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A Carousel of `slides` in `variant`'s layout, set in a Section as on a page. */
const carousel = (variant: string, label: string, slides: Record<string, unknown>[]) => [
  {
    type: "Section",
    props: {
      id: "section",
      contentWidth: "medium",
      content: [
        {
          type: "Carousel",
          props: {
            id: `carousel-${variant}`,
            label,
            variant,
            slides: slides.map((props, index) => ({
              type: "CarouselSlide",
              props: { id: `slide-${index + 1}`, name: "", text: "", ...props },
            })),
          },
        },
      ],
    },
  },
];

/** Large images, each with a caption (2.10). Without its script, the strip swipes and scrolls. */
export const Images: Story = {
  args: {
    nodes: carousel("images", "Our bakery", [
      { image: { mediaId: "photo", alt: "Loaves on the counter" }, text: "Fresh every morning." },
      { image: { mediaId: "photo", alt: "Cakes in the window" }, text: "Cakes to order." },
      { image: { mediaId: "photo", alt: "The shop at night" }, text: "Open until 6pm." },
    ]),
  },
};

/** Quotes from customers, with their names and photos (2.10). */
export const Testimonials: Story = {
  args: {
    nodes: carousel("testimonials", "What customers say", [
      {
        image: { mediaId: "photo", alt: "" },
        text: "The best sourdough in Hightown, and the friendliest welcome.",
        name: "Sam Patel",
      },
      { text: "They made our wedding cake. Everyone asked where it came from.", name: "Ana Ruiz" },
    ]),
  },
};

/** Logos, several in view at once (2.10). */
export const Logos: Story = {
  args: {
    nodes: carousel(
      "logos",
      "As seen in",
      ["Hightown Herald", "Bake Weekly", "Food Guide", "City Radio", "The Market"].map((name) => ({
        image: { mediaId: "photo", alt: name },
        name,
      })),
    ),
  },
};
