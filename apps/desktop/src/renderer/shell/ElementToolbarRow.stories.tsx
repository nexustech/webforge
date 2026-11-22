import type { Meta, StoryObj } from "@storybook/react-vite";
import { ColumnsTools } from "../editor/ColumnsToolbar.js";
import { FooterTools } from "../editor/FooterToolbar.js";
import { MobileMenuToggle } from "../editor/HeaderToolbar.js";
import { HeadingLevelToolbar } from "../editor/HeadingToolbar.js";
import { ListItemsToolbar } from "../editor/ListToolbar.js";
import { ElementToolbarRow } from "./ElementToolbarRow.js";

const meta = {
  title: "Shell/ElementToolbarRow",
  component: ElementToolbarRow,
  // Under the canvas toolbar, as wide as the canvas in a 1280 px window.
  render: (args) => (
    <div className="w-[760px]">
      <ElementToolbarRow {...args} />
    </div>
  ),
} satisfies Meta<typeof ElementToolbarRow>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing selected, or an element without a toolbar of its own: the row stays, empty. */
export const Empty: Story = {};

/** A Heading selected: its level, centred (SP-4). */
export const HeadingSelected: Story = {
  args: { children: <HeadingLevelToolbar value="medium" onChange={() => undefined} /> },
};

/** A List item selected: an item before or after it, or at the List's end (SP-4). */
export const ListItemSelected: Story = {
  args: { children: <ListItemsToolbar itemSelected onAdd={() => undefined} /> },
};

/** The List itself selected: an item at its end only. */
export const ListSelected: Story = {
  args: { children: <ListItemsToolbar itemSelected={false} onAdd={() => undefined} /> },
};

/** What every Columns story's toolbar does: nothing, in a story. */
const columnsActions = {
  onAdd: () => undefined,
  onRemove: () => undefined,
  onLayout: () => undefined,
  onOutlines: () => undefined,
} as const;

/** A Columns selected (2.17): three columns, the middle one wide on Desktop, outlines shown. */
export const ColumnsSelected: Story = {
  args: {
    children: (
      <ColumnsTools
        count={3}
        canAdd
        layout="wideMiddle"
        device="desktop"
        outlines
        {...columnsActions}
      />
    ),
  },
};

/** One column, which can't be removed; one layout only, on Mobile; outlines off. */
export const ColumnsOne: Story = {
  args: {
    children: (
      <ColumnsTools
        count={1}
        canAdd
        layout="equal"
        device="mobile"
        outlines={false}
        {...columnsActions}
      />
    ),
  },
};

/** Four columns, as many as a Columns holds: no more can be added. */
export const ColumnsFull: Story = {
  args: {
    children: (
      <ColumnsTools
        count={4}
        canAdd={false}
        layout="stacked"
        device="tablet"
        outlines
        {...columnsActions}
      />
    ),
  },
};

/** The Header selected in the Mobile view (UX-26): its menu shown open on the canvas. */
export const HeaderMobileMenu: Story = {
  args: { children: <MobileMenuToggle pressed onChange={() => undefined} /> },
};

/** What the Footer's toolbar does, in a story: nothing. */
const footerActions = {
  onStart: () => undefined,
  onAdd: () => undefined,
  onRemove: () => undefined,
} as const;

/** The Footer selected (HF-4, 5.39): *Start from* a preset, and two columns of three. */
export const FooterSelected: Story = {
  args: { children: <FooterTools count={2} elements={3} {...footerActions} /> },
};

/** A Footer of its text alone: no column to remove. */
export const FooterNoColumns: Story = {
  args: { children: <FooterTools count={0} elements={0} {...footerActions} /> },
};
