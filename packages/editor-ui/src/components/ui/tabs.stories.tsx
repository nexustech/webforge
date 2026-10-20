import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs.js";

const meta = {
  title: "Base/Tabs",
  component: Tabs,
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PanelTabs: Story = {
  render: () => (
    <Tabs defaultValue="content" className="h-48 w-72 border border-border-strong">
      <TabsList>
        <TabsTrigger value="content">Content</TabsTrigger>
        <TabsTrigger value="style">Style</TabsTrigger>
        <TabsTrigger value="advanced" disabled>
          Advanced
        </TabsTrigger>
      </TabsList>
      <TabsContent value="content" className="p-2 text-muted-foreground">
        Select an element to edit it
      </TabsContent>
      <TabsContent value="style" className="p-2">
        Style
      </TabsContent>
    </Tabs>
  ),
};
