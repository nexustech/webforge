import type { Meta, StoryObj } from "@storybook/react-vite";
import { panelStory } from "../testing/stories.js";
import { registerThemePanel } from "./register-theme-panel.js";
import { createStudio } from "./studio/studio-state.js";

// The Theme tab as registerThemePanel adds it, with its Theme Studio button.
const meta = { title: "Panels/Registered/Theme" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** As the area registers it, on a new site's starter page. */
export const Theme: Story = panelStory((panels, session) =>
  registerThemePanel(panels, session, undefined, createStudio()),
);
