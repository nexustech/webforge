import type { Meta, StoryObj } from "@storybook/react-vite";
import { panelStory } from "../testing/stories.js";
import { registerAddPanel } from "./register-add-panel.js";

// The Add panel as registerAddPanel adds it (2.20, B6).
const meta = { title: "Panels/Registered/Add" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** As the area registers it, on a new site's starter page. */
export const Add: Story = panelStory((panels, session) => registerAddPanel(panels, session));
