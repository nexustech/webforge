import type { Meta, StoryObj } from "@storybook/react-vite";
import { createSettingsRegistry } from "../editor/settings-registry.js";
import { createCommandRegistry } from "../shell/commands.js";
import { panelStory } from "../testing/stories.js";
import { registerFindReplacePanel } from "./register-find-replace-panel.js";

// Find and Replace as registerFindReplacePanel adds it (6.2).
const meta = { title: "Panels/Registered/Find and Replace" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** As the area registers it, before anything is typed. */
export const FindReplace: Story = panelStory((panels, session) =>
  registerFindReplacePanel({
    session,
    panels,
    commands: createCommandRegistry(),
    settings: createSettingsRegistry(),
    siteWide: { confirmSiteWide: async () => true },
  }),
);
