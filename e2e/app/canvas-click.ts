import { expect, type Locator } from "@playwright/test";
import { COMPONENT } from "@webforge/engine/puck-dom";

/** Puck's wrapper around each element on the canvas. */
const WRAPPER = COMPONENT;

/** What a canvas click takes: Playwright's click options, but never `force`, which this decides. */
type CanvasClickOptions = Omit<NonNullable<Parameters<Locator["click"]>[0]>, "force" | "trial">;

/**
 * Clicks `target` on the canvas as a user does (#465). Puck's wrapper around each element takes
 * the pointer for everything in it, and it is a group, not a button, so the element's links and
 * text aren't controls inside a control. Playwright clicks only an element it hits itself, or one
 * inside a button or link it hits, so it would refuse. This checks what Playwright checks, skipping
 * only that one check, and then clicks with force:
 * - `target` is visible and enabled, and stable: its box the same across two animation frames;
 * - the point clicked hits `target`, something in it, or the wrapper around it, so a click that
 *   something else would catch (another element's bar) still fails;
 * - in the editor's window, that point is the canvas, not a dialog or panel over it.
 */
export async function clickOnCanvas(
  target: Locator,
  options: CanvasClickOptions = {},
): Promise<void> {
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  const twoFrames = () =>
    target.evaluate(
      (element) =>
        new Promise((resolve) =>
          element.ownerDocument.defaultView?.requestAnimationFrame(() =>
            element.ownerDocument.defaultView?.requestAnimationFrame(resolve),
          ),
        ),
    );
  await expect
    .poll(
      async () => {
        const before = JSON.stringify(await target.boundingBox());
        await twoFrames();
        return before === JSON.stringify(await target.boundingBox());
      },
      { message: "the target keeps still" },
    )
    .toBe(true);

  const box = await target.boundingBox();
  if (box === null) throw new Error("The target has no box");
  const position = options.position ?? { x: box.width / 2, y: box.height / 2 };
  const hit = await target.evaluate(
    (element, { point, wrapper }) => {
      const rect = element.getBoundingClientRect();
      const at = element.ownerDocument.elementFromPoint(rect.left + point.x, rect.top + point.y);
      if (at === null) return "nothing";
      if (at === element || element.contains(at)) return "the target";
      if (at === element.closest(wrapper)) return "its wrapper";
      return `${at.tagName.toLowerCase()}.${at.className}`;
    },
    { point: position, wrapper: WRAPPER },
  );
  expect(["the target", "its wrapper"], `the click hits ${hit}`).toContain(hit);
  const over = await target.page().evaluate(
    ({ x, y }) => {
      const at = document.elementFromPoint(x, y);
      return at?.tagName === "IFRAME" ? null : `${at?.tagName.toLowerCase()}.${at?.className}`;
    },
    { x: box.x + position.x, y: box.y + position.y },
  );
  expect(over, `the canvas is covered by ${over}`).toBeNull();
  await target.click({ ...options, position, force: true });
}
