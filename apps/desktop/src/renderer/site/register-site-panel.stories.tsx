import type { Meta, StoryObj } from "@storybook/react-vite";
import { panelStory } from "../testing/stories.js";
import { registerSitePanel } from "./SitePanel.js";

// The Site panel's Pages and Menu as registerSitePanel adds them (2.20, B6).
const meta = { title: "Panels/Registered/Site" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** As the area registers it, on a new site's starter page. */
export const Site: Story = panelStory((panels, session) => registerSitePanel(panels, session));
