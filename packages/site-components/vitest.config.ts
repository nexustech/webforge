import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    // The Storybook stylesheets' sources, read as text by storybook-css.test.ts; Vitest empties CSS
    // otherwise.
    css: { include: [/\.storybook\/sources\.css/] },
  },
});
