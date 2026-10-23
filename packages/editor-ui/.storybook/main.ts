import babel from "@rolldown/plugin-babel";
import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import { reactCompilerPreset } from "@vitejs/plugin-react";

/**
 * Storybook for the editor UI: every component in dark and light (theme toolbar), with the a11y
 * addon. CI builds it statically and e2e/visual runs axe and screenshots over every story.
 */
const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  // The editor UI's components, and the desktop shell built from them (title bar, panel layout).
  stories: ["../src/**/*.stories.tsx", "../../../apps/desktop/src/renderer/**/*.stories.tsx"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-themes"],
  core: {
    // Webforge makes no network requests it doesn't need, the workshop included.
    disableTelemetry: true,
    disableWhatsNewNotifications: true,
  },
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    // Compiled as the app compiles them (ADR 0010), so the stories show what the app draws.
    plugins: [
      ...(viteConfig.plugins ?? []),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
  }),
};

export default config;
