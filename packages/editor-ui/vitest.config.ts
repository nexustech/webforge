import babel from "@rolldown/plugin-babel";
import { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

export default defineProject({
  // Tests run the components as the app builds them, compiled by the React Compiler (ADR 0010).
  plugins: [babel({ presets: [reactCompilerPreset()] })],
  test: {
    environment: "happy-dom",
    // Vitest empties CSS files by default; contrast.test.ts reads theme.css as text (?raw).
    css: { include: [/theme\.css/] },
  },
});
