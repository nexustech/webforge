import { test as base, expect } from "@playwright/test";
import { addNoMotionSheet, NO_MOTION_SHEET } from "../no-motion.js";

/** The exported site's tests' options (#1493). */
type MotionOptions = {
  /**
   * Whether pages move as visitors see them. Off by default: with reduced motion (the projects'
   * `reducedMotion`, playwright.config.ts) and the no-motion sheet in every page and frame, so a
   * test never reads the page mid-change. A test about motion itself turns it on, with
   * `test.use({ motion: true, reducedMotion: "no-preference" })` (e2e/README.md).
   */
  readonly motion: boolean;
};

/**
 * Playwright's `test`, with motion off unless a test turns it on (#1493). The exported site's specs
 * import `test` from here, never from `@playwright/test` (biome.json says so).
 */
export const test = base.extend<MotionOptions & { readonly noMotion: undefined }>({
  motion: [false, { option: true }],
  noMotion: [
    async ({ context, motion }, use) => {
      if (!motion) await context.addInitScript(addNoMotionSheet, NO_MOTION_SHEET);
      await use(undefined);
    },
    { auto: true },
  ],
});

export { expect };
