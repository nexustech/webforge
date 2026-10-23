import babel from "@rolldown/plugin-babel";
import { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * The React Compiler as the app's build runs it (apps/desktop/electron.vite.config.ts): the editor's
 * own code, not node_modules or the site components (ADR 0010).
 */
const compiled = () =>
  babel({
    presets: [reactCompilerPreset()],
    exclude: [/[\\/]node_modules[\\/]/, /[\\/]packages[\\/]site-components[\\/]/],
  });

/**
 * `pnpm test:compiled`: the unit tests of the code the compiler compiles, run on compiled code, so
 * they catch what only it changes, such as a component that relied on its parent drawing it again
 * (ADR 0010). Without coverage: the compiler's memo checks would count as branches of our code.
 * `pnpm test` measures coverage on the source.
 */
export default defineConfig({
  test: {
    projects: [
      {
        extends: "./apps/desktop/vitest.config.ts",
        plugins: [compiled()],
        test: {
          name: "desktop renderer (compiled)",
          root: "./apps/desktop",
          include: ["src/renderer/**/*.test.{ts,tsx}"],
        },
      },
      {
        extends: "./packages/editor-ui/vitest.config.ts",
        plugins: [compiled()],
        test: {
          name: "editor-ui (compiled)",
          root: "./packages/editor-ui",
          include: ["src/**/*.test.{ts,tsx}"],
        },
      },
      {
        plugins: [compiled()],
        test: {
          name: "engine (compiled)",
          root: "./packages/engine",
          include: ["src/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
