import type { Meta, StoryObj } from "@storybook/react-vite";
import { panelStory } from "../testing/stories.js";
import { registerMediaPanel } from "./register-media-panel.js";

// The Media panel as registerMediaPanel adds it (2.20, B6).
const meta = { title: "Panels/Registered/Media" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** As the area registers it, on a new site's starter page. */
export const Media: Story = panelStory((panels, session) => registerMediaPanel(panels, session));
