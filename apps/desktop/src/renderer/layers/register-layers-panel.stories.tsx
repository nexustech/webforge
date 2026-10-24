import type { Meta, StoryObj } from "@storybook/react-vite";
import { panelStory } from "../testing/stories.js";
import { registerLayersPanel } from "./register-layers-panel.js";

// The Layers panel as registerLayersPanel adds it (2.20, B6).
const meta = { title: "Panels/Registered/Layers" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** As the area registers it, on a new site's starter page. */
export const Layers: Story = panelStory((panels, session, { preferences }) =>
  registerLayersPanel(panels, session, { preferences }),
);
