import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { Page } from "@playwright/test";

/**
 * axe-core, as `@axe-core/playwright` has it: run in the canvas's own frame, which AxeBuilder's
 * frame handling in Electron doesn't reach on every platform (2.15c).
 */
const AXE_SOURCE = readFileSync(
  createRequire(createRequire(import.meta.url).resolve("@axe-core/playwright")).resolve(
    "axe-core/axe.min.js",
  ),
  "utf8",
);

/** What axe found on the canvas: its violations, and how many rules passed. */
type CanvasAxeResults = {
  readonly violations: readonly { readonly id: string; readonly help: string }[];
  readonly passes: number;
};

/**
 * Runs axe (WCAG 2.1 A and AA) on the page the canvas draws, inside its frame: what the editor adds
 * to it included (#465).
 */
export async function canvasAxe(page: Page): Promise<CanvasAxeResults> {
  const element = await page.locator(".editor__canvas iframe").elementHandle();
  const frame = await element?.contentFrame();
  if (frame === null || frame === undefined) throw new Error("No canvas frame");
  await frame.evaluate(AXE_SOURCE);
  return frame.evaluate(
    async (tags) => {
      const { axe } = window as unknown as {
        axe: {
          run(
            context: Document,
            options: object,
          ): Promise<{
            violations: { id: string; help: string }[];
            passes: unknown[];
          }>;
        };
      };
      const { violations, passes } = await axe.run(document, {
        runOnly: { type: "tag", values: tags },
      });
      return {
        violations: violations.map(({ id, help }) => ({ id, help })),
        passes: passes.length,
      };
    },
    ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
  );
}
