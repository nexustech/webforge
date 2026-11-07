import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { Page } from "@playwright/test";

/** axe-core's own script, as `@axe-core/playwright` bundles it, run in the window's page. */
const AXE_SOURCE = readFileSync(
  createRequire(createRequire(import.meta.url).resolve("@axe-core/playwright")).resolve(
    "axe-core/axe.min.js",
  ),
  "utf8",
);

/** One rule axe found broken, with the elements it found it on, so a failure says where. */
export type WindowAxeViolation = {
  readonly id: string;
  readonly impact: string | null;
  readonly help: string;
  readonly targets: readonly string[];
};

/**
 * Runs axe (WCAG 2.1 A and AA) on a window of the app as it is now: the editor's own controls,
 * panels and any dialog open in it (5.5). Inside the canvas's frame is the site, which `canvasAxe`
 * checks in its own document, so only the frame element itself is checked here.
 */
export async function windowAxe(page: Page): Promise<readonly WindowAxeViolation[]> {
  // Transitions done: a colour part-way through one is neither the old one nor the new.
  await page.evaluate(async () => {
    const settling = document
      .getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations !== Number.POSITIVE_INFINITY)
      .map((animation) => animation.finished.catch(() => undefined));
    await Promise.race([
      Promise.all(settling),
      new Promise((resolve) => setTimeout(resolve, 3_000)),
    ]);
  });
  await page.evaluate(AXE_SOURCE);
  return page.evaluate(
    async (tags) => {
      const { axe } = window as unknown as {
        axe: {
          run(
            context: object,
            options: object,
          ): Promise<{
            violations: {
              id: string;
              impact: string | null;
              help: string;
              nodes: { target: unknown[] }[];
            }[];
          }>;
        };
      };
      // The canvas's frame element is checked (its name), but not inside it.
      const { violations } = await axe.run(document, {
        runOnly: { type: "tag", values: tags },
        iframes: false,
      });
      return violations.map(({ id, impact, help, nodes }) => ({
        id,
        impact,
        help,
        targets: nodes.map((node) => node.target.map(String).join(" ")),
      }));
    },
    ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
  );
}
