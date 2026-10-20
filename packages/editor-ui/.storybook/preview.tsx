import { withThemeByDataAttribute } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";
import { TooltipProvider } from "../src/components/ui/tooltip.js";
import "./preview.css";

/** Themes for the toolbar; the same `data-theme` attribute the desktop app sets on <html>. */
const THEMES = { dark: "dark", light: "light" } as const;

const preview: Preview = {
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
    withThemeByDataAttribute({
      themes: THEMES,
      defaultTheme: "dark",
      attributeName: "data-theme",
      parentSelector: "html",
    }),
  ],
  parameters: {
    layout: "padded",
    backgrounds: { disable: true },
  },
};

export default preview;
