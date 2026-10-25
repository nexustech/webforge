import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = {
  title: "Site components/Team",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Three people, each with the stories' photo. */
const PEOPLE = [
  { name: "Rosa Lopez", role: "Owner and baker", text: "<p>Up at four for the first loaves.</p>" },
  { name: "Ben Carter", role: "Pastry chef", text: "<p>Croissants, tarts and birthday cakes.</p>" },
  { name: "Mia Novak", role: "Front of shop", text: "<p>Knows every regular by name.</p>" },
].map((person, index) => ({
  type: "TeamMember",
  props: { id: `team-member-${index}`, ...person, photo: { mediaId: "photo" } },
}));

/** The Team section in `variant`. */
const team = (variant: string): Story => ({
  args: {
    nodes: [
      {
        type: "Team",
        props: {
          id: `team-${variant}`,
          title: "Meet the team",
          text: "<p>The people you'll see when you visit.</p>",
          items: PEOPLE,
          variant,
        },
      },
    ],
  },
});

/** Cards, each photo on top. */
export const Cards: Story = team("cards");

/** Round photos, the words centred below. */
export const RoundPhotos: Story = team("round");

/** A list in two columns, each photo beside its words. */
export const List: Story = team("list");
