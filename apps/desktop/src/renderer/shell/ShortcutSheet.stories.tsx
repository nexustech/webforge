import type { Meta, StoryObj } from "@storybook/react-vite";
import { COMMAND_IDS } from "./command-ids.js";
import { type Command, createCommandRegistry } from "./commands.js";
import { SheetGroups } from "./SheetGroups.js";

const noop = () => undefined;

/** The editor's commands with keys, as the app registers them, on Windows or a Mac. */
function commands(mac: boolean): readonly Command[] {
  const registry = createCommandRegistry({ mac });
  const labels: readonly (readonly [string, string])[] = [
    [COMMAND_IDS.newSite, "New Site…"],
    [COMMAND_IDS.openSite, "Open Site…"],
    [COMMAND_IDS.exportSite, "Export Site…"],
    [COMMAND_IDS.undo, "Undo"],
    [COMMAND_IDS.redo, "Redo"],
    ["edit.cut", "Cut"],
    ["edit.copy", "Copy"],
    ["edit.paste", "Paste"],
    ["edit.duplicate", "Duplicate"],
    ["edit.delete", "Delete"],
    ["edit.moveUp", "Move Up"],
    ["edit.moveDown", "Move Down"],
    ["edit.toggleHidden", "Leave Off the Website"],
    ["edit.rename", "Rename…"],
    ["edit.selectParent", "Select Parent"],
    ["edit.selectChild", "Select first child"],
    [COMMAND_IDS.commandBox, "Search Commands…"],
    [COMMAND_IDS.zoomIn, "Zoom In"],
    [COMMAND_IDS.zoomOut, "Zoom Out"],
    [COMMAND_IDS.desktopView, "Desktop View"],
    [COMMAND_IDS.tabletView, "Tablet View"],
    [COMMAND_IDS.mobileView, "Mobile View"],
    [COMMAND_IDS.shortcuts, "Keyboard Shortcuts"],
  ];
  for (const [id, label] of labels) registry.register({ id, label, run: noop });
  return registry.list();
}

const meta = {
  title: "Shell/ShortcutSheet",
  component: SheetGroups,
  args: { commands: commands(false), idPrefix: "sheet", mac: false },
  // As wide as the dialog shows it.
  render: (args) => (
    <div className="w-[720px] p-4">
      <SheetGroups {...args} />
    </div>
  ),
} satisfies Meta<typeof SheetGroups>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Windows and Linux: Ctrl, Alt and Shift by name. */
export const Windows: Story = {};

/** A Mac: ⌘ ⌥ ⇧, and Cmd+Backspace where Windows has Delete. */
export const Mac: Story = { args: { commands: commands(true), mac: true } };

/** A wide window, where the dialog is wider: three columns. */
export const Wide: Story = {
  render: (args) => (
    <div className="w-[1024px] p-4">
      <SheetGroups {...args} />
    </div>
  ),
};

/** A narrow one: one column, never wider than the dialog. */
export const Narrow: Story = {
  render: (args) => (
    <div className="w-[320px] p-4">
      <SheetGroups {...args} />
    </div>
  ),
};

/** Searched for "zoom": the rows that match, under their groups' headings. */
export const Searched: Story = { args: { search: "zoom" } };

/** Searched by keys. */
export const SearchedByKeys: Story = { args: { search: "Ctrl+D" } };

/** Nothing matches the search. */
export const NoMatch: Story = { args: { search: "sparkle" } };
