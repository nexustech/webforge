import type { Meta, StoryObj } from "@storybook/react-vite";
import { t } from "@webforge/i18n";
import type { SharedSectionId } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { userEvent, within } from "storybook/test";
import { AddPanel } from "./AddPanel.js";
import { addItems, suggestedItems, withFavourites } from "./add-items.js";

const noop = () => undefined;
const anywhere = (_type: string): boolean => true;

const meta = {
  title: "Panels/Add",
  component: AddPanel,
  args: {
    sections: addItems(siteLibrary, "sections"),
    elements: addItems(siteLibrary, "elements"),
    tab: "sections",
    onTabChange: noop,
    onAdd: noop,
    canAdd: anywhere,
    point: null,
    onCancelPoint: noop,
  },
  // In a panel-sized frame, as in the left column.
  render: (args) => (
    <div className="h-96 w-60 border border-border-strong bg-panel">
      <AddPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof AddPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sections, by category. */
export const Sections: Story = {};

/** The site's shared sections first, each placed as a linked copy (F-ED-23). */
export const SharedSections: Story = {
  args: {
    sections: [
      ...(["Opening hours", "Testimonials"] as const).map((label, index) => ({
        type: `shared-${index}`,
        label,
        category: t("add.sharedSections"),
        sharedSectionId: `shared-${index}` as SharedSectionId,
      })),
      ...addItems(siteLibrary, "sections"),
    ],
  },
};

/** Opened by the canvas's +: the section chosen goes after the Hero. */
export const AtThePlus: Story = { args: { point: { after: "Hero" } } };

/** Elements, which go into the selected section. */
export const Elements: Story = { args: { tab: "elements" } };

/** A List selected: its items first, under Suggested (SP-12). */
export const Suggested: Story = {
  args: {
    tab: "elements",
    elements: [...suggestedItems(siteLibrary, ["ListItem"]), ...addItems(siteLibrary, "elements")],
  },
};

/** Elements on a page with no section to take them. */
export const NoSection: Story = { args: { tab: "elements", canAdd: () => false } };

/** A search that finds nothing. */
export const NoMatch: Story = {
  play: async ({ canvasElement }) => {
    // A word no item has.
    await userEvent.type(within(canvasElement).getByRole("searchbox"), "zebra");
  },
};

const FAVOURITES = new Set(["Faq"]);

/** The person's favourites first, then what they added lately (F-ED-26, UX-10). */
export const Favourites: Story = {
  args: {
    sections: withFavourites(addItems(siteLibrary, "sections"), ["Faq"], ["Hero", "Faq"]),
    favourites: { has: (type) => FAVOURITES.has(type), toggle: noop },
  },
};
