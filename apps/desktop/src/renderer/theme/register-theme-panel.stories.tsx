import type { Meta, StoryObj } from "@storybook/react-vite";
import { DEFAULT_PREFERENCES } from "../../shared/ipc/prefs.js";
import { starterSite } from "../../shared/starter-site.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { panelStory } from "../testing/stories.js";
import { registerThemePanel } from "./register-theme-panel.js";
import { createStudio } from "./studio/studio-state.js";

// The Theme tab as registerThemePanel adds it, with its Theme Studio button.
const meta = { title: "Panels/Registered/Theme" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** As the area registers it, on a new site's starter page: Simple mode, with no codes (LF-16). */
export const Theme: Story = panelStory((panels, session) =>
  registerThemePanel(panels, session, undefined, createStudio()),
);

/** A starter site whose brand colour is too pale to read on the page. */
function paleBrand() {
  const site = starterSite();
  site.theme.colors.primary = { l: 0.85, c: 0.08, h: 277 };
  return site;
}

/** A brand colour hard to read, in words, with a darker shade one click away (#1174). */
export const HardToRead: Story = panelStory(
  (panels, session) => registerThemePanel(panels, session, undefined, createStudio()),
  { site: paleBrand() },
);

/** In Advanced mode: hex codes, contrast ratios and a size for each text style. */
export const Advanced: Story = panelStory(
  (panels, session) =>
    registerThemePanel(
      panels,
      session,
      undefined,
      createStudio(),
      undefined,
      undefined,
      createPreferencesStore({ preferences: { ...DEFAULT_PREFERENCES, editorLevel: "advanced" } }),
    ),
  { site: paleBrand() },
);
