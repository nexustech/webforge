import babel from "@rolldown/plugin-babel";
import { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

export default defineProject({
  // Tests run the components as the app builds them, compiled by the React Compiler (ADR 0010).
  plugins: [babel({ presets: [reactCompilerPreset()] })],
  test: {
    // The renderer's tests drive React panels and dialogs in happy-dom: CPU-bound work, not
    // waiting. When other checks or E2E share the machine, a few took past the 5 s default.
    testTimeout: 15_000,
  },
});
