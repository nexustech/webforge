import type { Meta, StoryObj } from "@storybook/react-vite";
import { createSettingsRegistry } from "../editor/settings-registry.js";
import { panelStory } from "../testing/stories.js";
import { registerSiteCheckPanel } from "./register-site-check-panel.js";

// Site Check as registerSiteCheckPanel adds it (3.6, 2.20 B6).
const meta = { title: "Panels/Registered/Site Check" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** As the area registers it, checking a new site: its starter text and its missing web address. */
export const SiteCheck: Story = panelStory((panels, session) =>
  registerSiteCheckPanel(panels, {
    session,
    settings: createSettingsRegistry(),
    commands: { run: () => false },
    openGuide: () => undefined,
    ignored: [],
    saveIgnored: () => undefined,
  }),
);
