import type { Meta, StoryObj } from "@storybook/react-vite";
import { DEFAULT_PREFERENCES } from "../../shared/ipc/prefs.js";
import { starterSite } from "../../shared/starter-site.js";
import { createSettingsRegistry } from "../editor/settings-registry.js";
import { registerAppSettings, SettingsDialog } from "../settings/index.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { siteSettingsPart } from "./site-part.js";

/** Settings as the window opens them: the app's parts with one device of the person's, and a site. */
function parts() {
  const registry = createSettingsRegistry();
  registerAppSettings(
    registry,
    createPreferencesStore({
      preferences: {
        ...DEFAULT_PREFERENCES,
        canvas: {
          ...DEFAULT_PREFERENCES.canvas,
          devices: [{ id: "kiosk", name: "Shop kiosk", width: 1080, height: 1920 }],
        },
      },
    }),
  );
  const site = starterSite();
  site.settings.general = { name: "Rosa's Bakery", description: "", language: "en-GB" };
  return [
    ...registry.list().flatMap((entry) => entry.open() ?? []),
    siteSettingsPart(
      site,
      () => undefined,
      () => "",
    ),
  ];
}

const meta = {
  title: "Dialogs/Settings",
  component: SettingsDialog,
  tags: ["full-window"],
  args: {
    open: true,
    parts: parts(),
    onSaved: () => undefined,
    onCancel: () => undefined,
  },
} satisfies Meta<typeof SettingsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** App › Interface: the editor's theme and its mode, under the sections of App and This site. */
export const Interface: Story = { args: { initialGroup: "interface:" } };

/** App › Devices: the person's own devices for the canvas. */
export const Devices: Story = { args: { initialGroup: "devices:" } };

/** This site › General, as File → Site Settings… opens it. */
export const ThisSite: Story = { args: { initialGroup: "site:general" } };
