import type { Meta, StoryObj } from "@storybook/react-vite";
import { CloudUploadIcon, SettingsIcon, TrashIcon } from "lucide-react";
import { Button } from "./button.js";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "./dropdown-menu.js";

const meta = {
  title: "Base/DropdownMenu",
  component: DropdownMenu,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The Publish split-button menu, open. */
export const PublishMenu: Story = {
  render: () => (
    <div className="h-80 p-4">
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">
            <CloudUploadIcon className="text-publish" />
            Publish
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Publish destination</DropdownMenuLabel>
          <DropdownMenuRadioGroup value="netlify">
            <DropdownMenuRadioItem value="netlify">Netlify</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="ftp">FTP</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked>Open the site when done</DropdownMenuCheckboxItem>
          <DropdownMenuItem>
            <SettingsIcon />
            Settings
            <DropdownMenuShortcut>Ctrl+,</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>Unpublish</DropdownMenuItem>
          <DropdownMenuItem variant="destructive">
            <TrashIcon />
            Remove destination
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
};
