import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import { themeGallery, writeThemeStylesheets } from "./theme-gallery.js";

// Each preset's stylesheet, for the theme stories (2.13) and the stories' theme (2.16).
writeThemeStylesheets();

/**
 * Storybook for the site components (standards §5): every component's variants as the export
 * renders them, with toolbars for the theme and the device width, and the a11y addon. CI builds it
 * statically, and e2e/visual runs axe and screenshots over every story in each theme, on Desktop
 * and Mobile.
 */
const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-a11y"],
  core: {
    // Webforge makes no network requests it doesn't need, the workshop included.
    disableTelemetry: true,
    disableWhatsNewNotifications: true,
  },
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: [...(viteConfig.plugins ?? []), tailwindcss(), themeGallery()],
  }),
};

export default config;
