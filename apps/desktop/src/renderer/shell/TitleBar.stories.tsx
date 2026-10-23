import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { userEvent, within } from "storybook/test";
import { CommandRegistryProvider } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { type Command, createCommandRegistry } from "./commands.js";
import { TitleBar } from "./TitleBar.js";

const noop = () => undefined;

/** The commands the title bar shows once every area has contributed its own. */
const COMMANDS: readonly Command[] = [
  {
    id: COMMAND_IDS.newSite,
    label: "New Site…",
    menu: "file",
    shortcut: "Mod+N",
    run: noop,
  },
  {
    id: COMMAND_IDS.openSite,
    label: "Open Site…",
    menu: "file",
    shortcut: "Mod+O",
    run: noop,
  },
  { id: COMMAND_IDS.undo, label: "Undo", menu: "edit", shortcut: "Mod+Z", run: noop },
  {
    id: COMMAND_IDS.redo,
    label: "Redo",
    menu: "edit",
    shortcut: "Mod+Shift+Z",
    enabled: false,
    run: noop,
  },
  { id: COMMAND_IDS.preview, label: "Preview", menu: "file", run: noop },
  { id: COMMAND_IDS.exportSite, label: "Export Site…", menu: "file", run: noop },
  { id: COMMAND_IDS.publish, label: "Publish…", menu: "file", run: noop },
];

function WithCommands({ commands }: { readonly commands: readonly Command[] }) {
  const [registry] = useState(() => {
    const created = createCommandRegistry();
    for (const command of commands) created.register(command);
    return created;
  });
  return (
    <CommandRegistryProvider registry={registry}>
      <TitleBar
        siteName="Bloom Bakery"
        saveStatus={
          <span className="flex items-center gap-1 px-1 text-xs text-save-status">
            <CheckIcon className="size-3.5" />
            Saved
          </span>
        }
      />
    </CommandRegistryProvider>
  );
}

const meta = {
  title: "Shell/TitleBar",
  component: TitleBar,
  parameters: { layout: "fullscreen" },
  args: { siteName: "Bloom Bakery" },
} satisfies Meta<typeof TitleBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every area has contributed its commands (Redo has nothing to redo). */
export const Complete: Story = {
  render: () => <WithCommands commands={COMMANDS} />,
};

const EARLY = new Set<string>([COMMAND_IDS.undo, COMMAND_IDS.redo, COMMAND_IDS.exportSite]);

/** Before New, Open, Preview and Publish exist (Phase 1): their buttons are disabled. */
export const EarlyCommands: Story = {
  render: () => <WithCommands commands={COMMANDS.filter((command) => EARLY.has(command.id))} />,
};

/** The palette open (Ctrl/Cmd+P): commands, pages to go to and things to add (UX-11). */
export const Palette: Story = {
  render: () => (
    <WithCommands
      commands={[
        ...COMMANDS,
        { id: "page.goto.home", label: "Home", palette: "pages", keywords: ["index"], run: noop },
        { id: "page.goto.about", label: "About", palette: "pages", keywords: ["about"], run: noop },
        { id: "add.item.Hero", label: "Add Hero", palette: "add", run: noop },
        { id: "add.item.Text", label: "Add Text", palette: "add", enabled: false, run: noop },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /^Search commands/ }));
  },
};
