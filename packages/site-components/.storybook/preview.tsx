import { withThemeByDataAttribute } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";
import "./preview.css";

/** The themes stories show components in: daisyUI's, until 2.3 brings the curated themes. */
const THEMES = { light: "light", dark: "dark", cupcake: "cupcake" } as const;

/** The device widths of the canvas toolbar (1.15). */
const DEVICES = {
  desktop: { name: "Desktop", styles: { width: "1280px", height: "800px" }, type: "desktop" },
  tablet: { name: "Tablet", styles: { width: "768px", height: "1024px" }, type: "tablet" },
  mobile: { name: "Mobile", styles: { width: "375px", height: "812px" }, type: "mobile" },
} as const;

const preview: Preview = {
  decorators: [
    withThemeByDataAttribute({
      themes: THEMES,
      defaultTheme: "light",
      attributeName: "data-theme",
      parentSelector: "html",
    }),
  ],
  parameters: {
    // A site's sections run edge to edge, as on a page.
    layout: "fullscreen",
    backgrounds: { disable: true },
    viewport: { options: DEVICES },
  },
  initialGlobals: { viewport: { value: "desktop", isRotated: false } },
};

export default preview;
