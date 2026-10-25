import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = {
  title: "Site components/Pricing",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A cleaner's three plans, the middle one highlighted. */
const PLANS = [
  { name: "One-off clean", price: "£45", period: "a visit", featured: false },
  { name: "Fortnightly", price: "£38", period: "a visit", featured: true },
  { name: "Weekly", price: "£32", period: "a visit", featured: false },
].map((plan, index) => ({
  type: "PricingPlan",
  props: {
    id: `pricing-plan-${index}`,
    ...plan,
    details: "<p>Kitchen, bathroom and floors, with our own products.</p>",
    buttonLabel: "Book now",
    link: { kind: "page", pageId: "home" },
  },
}));

/** The Pricing section in `variant`. */
const pricing = (variant: string): Story => ({
  args: {
    nodes: [
      {
        type: "Pricing",
        props: {
          id: `pricing-${variant}`,
          title: "Prices",
          text: "<p>Simple prices, no surprises.</p>",
          items: PLANS,
          variant,
        },
      },
    ],
  },
});

/** Cards side by side. */
export const Cards: Story = pricing("cards");

/** A price list, one plan to a row. */
export const PriceList: Story = pricing("list");
