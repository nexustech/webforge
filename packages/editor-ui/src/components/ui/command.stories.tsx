import type { Meta, StoryObj } from "@storybook/react-vite";
import { FilePlusIcon, LayoutPanelLeftIcon } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command.js";

const meta = {
  title: "Base/Command",
  component: Command,
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The title-bar command box, open. */
export const CommandBox: Story = {
  render: () => (
    <Command className="w-96 border border-border-strong" label="Commands">
      <CommandInput placeholder="Search commands and pages" />
      <CommandList>
        <CommandEmpty>Nothing found</CommandEmpty>
        <CommandGroup heading="Pages">
          <CommandItem>
            <FilePlusIcon />
            Add page
            <CommandShortcut>Ctrl+N</CommandShortcut>
          </CommandItem>
          <CommandItem>About</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="View">
          <CommandItem>
            <LayoutPanelLeftIcon />
            Reset Panels
          </CommandItem>
          <CommandItem disabled>Advanced mode</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};
