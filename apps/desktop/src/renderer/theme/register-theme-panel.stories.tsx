import type { Meta, StoryObj } from "@storybook/react-vite";
import { panelStory } from "../testing/stories.js";
import { registerThemePanel } from "./register-theme-panel.js";

// The Theme panel as registerThemePanel adds it.
const meta = { title: "Panels/Registered/Theme" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** As the area registers it, on a new site's starter page. */
export const Theme: Story = panelStory((panels, session) => registerThemePanel(panels, session));
