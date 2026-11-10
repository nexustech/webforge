import type { Meta, StoryObj } from "@storybook/react-vite";
import { createStore } from "zustand/vanilla";
import { DEFAULT_PREFERENCES } from "../../shared/ipc/prefs.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { panelStory } from "../testing/stories.js";
import { storyPreloadApi } from "../testing/story-preload.js";
import { registerStylesheetPanel } from "./register-stylesheet-panel.js";

// The Stylesheet panel as registerStylesheetPanel adds it (6.8), in Advanced mode.
const meta = { title: "Panels/Registered/Stylesheet" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const api = storyPreloadApi();

/** As the area registers it, on a site with no stylesheet yet. */
export const Stylesheet: Story = panelStory((panels, session, { commands }) =>
  registerStylesheetPanel({
    session,
    panels,
    commands,
    preferences: createPreferencesStore({
      preferences: { ...DEFAULT_PREFERENCES, editorLevel: "advanced" },
    }),
    canvas: () => api.canvas,
    allowListConfirmed: createStore(() => false),
  }),
);
