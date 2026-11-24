import type { Meta, StoryObj } from "@storybook/react-vite";
import { insertPage, newId } from "@webforge/model";
import { sessionWith } from "../../testing/fixtures.js";
import { PagesField } from "./PagesField.js";

// The Edit panel's pages field (HF-8), for the Footer's Menu links: the menu's pages to leave out,
// or the site's other pages to add.

const session = sessionWith();
session.edit("insert", "Added pages", (draft) => {
  for (const title of ["Menu", "Download", "Privacy"]) insertPage(draft, newId("page"), title);
  // Shown as the Header's button, so hidden in the menu.
  for (const page of Object.values(draft.pages)) {
    if (page.title === "Download" || page.title === "Privacy") {
      page.settings.hideFromNavigation = true;
    }
  }
});
const site = session.history.document.getState();
const idOf = (title: string) =>
  Object.values(site.pages).find((page) => page.title === title)?.id ?? "";

const meta = {
  title: "Edit/Fields/Pages",
  component: PagesField,
  args: {
    id: "field-pages",
    labelId: "field-pages-label",
    field: { kind: "pages", label: "Leave out", from: "menu" },
    value: [],
    onChange: () => undefined,
    onCommit: () => undefined,
    session,
  },
  // As in the Edit panel: its label above, in the right column's width.
  render: (args) => (
    <div className="flex w-60 flex-col gap-1 border border-border-strong bg-panel p-2">
      <span id="field-pages-label" className="text-xs text-muted-foreground">
        {args.field.label}
      </span>
      <PagesField {...args} />
    </div>
  ),
} satisfies Meta<typeof PagesField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The menu's pages, none left out. */
export const LeaveOut: Story = {};

/** The menu's pages, one left out. */
export const OneLeftOut: Story = { args: { value: [idOf("Menu")] } };

/** The pages the menu doesn't show, Download added: it's the Header's button. */
export const Add: Story = {
  args: { field: { kind: "pages", label: "Add", from: "others" }, value: [idOf("Download")] },
};
