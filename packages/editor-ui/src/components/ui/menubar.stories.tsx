import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "./menubar.js";

const meta = {
  title: "Base/Menubar",
  component: Menubar,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Menubar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The title bar's app menu with View open. */
export const ViewMenu: Story = {
  render: () => (
    <div className="h-72 bg-titlebar p-1">
      <Menubar value="view">
        <MenubarMenu value="file">
          <MenubarTrigger>File</MenubarTrigger>
        </MenubarMenu>
        <MenubarMenu value="edit">
          <MenubarTrigger>Edit</MenubarTrigger>
        </MenubarMenu>
        <MenubarMenu value="view">
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent>
            <MenubarCheckboxItem checked>Left panels</MenubarCheckboxItem>
            <MenubarCheckboxItem checked>Right panels</MenubarCheckboxItem>
            <MenubarCheckboxItem>Advanced mode</MenubarCheckboxItem>
            <MenubarSeparator />
            <MenubarItem>
              Reset Panels
              <MenubarShortcut>Ctrl+0</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  ),
};
