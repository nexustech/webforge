import stylesheets from "virtual:webforge-theme-css/lazy";
import type { Loader, Preview } from "@storybook/react-vite";
import { THEME_PRESETS } from "@webforge/themes";

/**
 * The themes stories show components in (2.16): Webforge's presets, each the whole stylesheet an
 * export with that theme has (Tailwind, the theme and its fonts). The visual tests use the three
 * development presets on every pull request, and every preset nightly.
 */
const PRESETS = THEME_PRESETS.map((preset) => preset.preset);

/** The device widths of the canvas toolbar (1.15). */
const DEVICES = {
  desktop: { name: "Desktop", styles: { width: "1280px", height: "800px" }, type: "desktop" },
  tablet: { name: "Tablet", styles: { width: "768px", height: "1024px" }, type: "tablet" },
  mobile: { name: "Mobile", styles: { width: "375px", height: "812px" }, type: "mobile" },
} as const;

/**
 * Puts the toolbar's preset on the page before the story renders: its stylesheet, and its name as
 * `<html>`'s `data-theme`, as the export's pages have them. A theme's settings (fonts, spacing, type
 * scale) apply to the whole page, so a page has one theme at a time.
 */
const applyTheme: Loader = async ({ globals }) => {
  const chosen = typeof globals.theme === "string" ? globals.theme : "";
  const preset = PRESETS.includes(chosen) ? chosen : "light";
  const css = (await stylesheets[preset]?.()) ?? "";
  let style = document.getElementById("webforge-theme");
  if (style === null) {
    style = document.createElement("style");
    style.id = "webforge-theme";
    document.head.append(style);
  }
  style.textContent = css;
  document.documentElement.dataset.theme = preset;
  return {};
};

const preview: Preview = {
  loaders: [applyTheme],
  globalTypes: {
    theme: {
      description: "Theme",
      toolbar: { title: "Theme", icon: "paintbrush", items: PRESETS, dynamicTitle: true },
    },
  },
  parameters: {
    // A site's sections run edge to edge, as on a page.
    layout: "fullscreen",
    backgrounds: { disable: true },
    viewport: { options: DEVICES },
  },
  initialGlobals: { theme: "light", viewport: { value: "desktop", isRotated: false } },
};

export default preview;
