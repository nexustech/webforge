import type { Meta, StoryObj } from "@storybook/react-vite";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./resizable.js";

const meta = {
  title: "Base/Resizable",
  component: ResizablePanelGroup,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ResizablePanelGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The UI1 columns: left and right panels around the canvas, each split top/bottom 60/40. */
export const Columns: Story = {
  render: () => (
    <div className="h-96">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="25%" minSize="15%">
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize="60%" className="bg-panel p-2 text-xs">
              Add
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel className="bg-panel p-2 text-xs">Undo History</ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel className="canvas-backdrop p-2 text-xs">Canvas</ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize="25%" minSize="15%" className="bg-panel p-2 text-xs">
          Edit
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  ),
};
