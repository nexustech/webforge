import type { Meta, StoryObj } from "@storybook/react-vite";
import { fireEvent, within } from "storybook/test";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "./context-menu.js";

const meta = {
  title: "Base/ContextMenu",
  component: ContextMenu,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ContextMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The canvas's right-click menu, opened by the story. */
export const ElementMenu: Story = {
  render: () => (
    <div className="h-80 p-4">
      <ContextMenu modal={false}>
        <ContextMenuTrigger className="flex h-16 w-64 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
          Heading
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>Heading</ContextMenuLabel>
          <ContextMenuItem>
            Duplicate
            <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>Move up</ContextMenuItem>
          <ContextMenuCheckboxItem>Hide</ContextMenuCheckboxItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive">
            Delete
            <ContextMenuShortcut>Del</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  ),
  play: ({ canvasElement }) => {
    fireEvent.contextMenu(within(canvasElement).getByText("Heading"), {
      clientX: 40,
      clientY: 40,
    });
  },
};
