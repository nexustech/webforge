import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    environment: "happy-dom",
    // Vitest empties CSS files by default; contrast.test.ts reads theme.css as text (?raw).
    css: { include: [/theme\.css/] },
  },
});
