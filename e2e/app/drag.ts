import { expect, type FrameLocator, type Locator, type Page } from "@playwright/test";

export type Box = { x: number; y: number; width: number; height: number };

/**
 * The element's position, once it has one. Puck swaps the rich-text element when its editor
 * finishes loading (ADR 0004), so a single read can land between the old and the new element.
 */
export async function boxOf(target: Locator, name: string): Promise<Box> {
  let box: Box | null = null;
  await expect
    .poll(
      async () => {
        box = await target.boundingBox();
        return box !== null;
      },
      { message: `${name} is not visible` },
    )
    .toBe(true);
  return box as unknown as Box;
}

/** Puck marks the canvas while something is being dragged over it. */
const DRAGGING = "[data-puck-entry][data-puck-dragging]";
/** Where the drop would land: Puck's placeholder in the list, or its line between items. */
const DROP_PREVIEW = "[data-dnd-placeholder], [data-puck-line-placeholder]";

/** How many times {@link drag} presses before it gives up on the drag starting. */
const PRESSES = 3;

/**
 * Whether Puck can start a drag from `from` now: no drag is still ending (dnd-kit ignores a press
 * until its last one is idle), and the element it is in may be dragged (Puck marks one that may
 * not, as while it is drawn again, with `data-puck-disabled`).
 */
async function dragReady(canvas: FrameLocator, from: Locator): Promise<void> {
  await expect(canvas.locator(DRAGGING)).toHaveCount(0);
  await expect
    .poll(
      () =>
        from.evaluate(
          (element) =>
            // A source outside the canvas (the Add panel's items) has no element of Puck's.
            element.closest("[data-puck-component]")?.hasAttribute("data-puck-disabled") ?? false,
        ),
      { message: "The drag source can't be dragged" },
    )
    .toBe(false);
}

/**
 * Drags with real mouse events, as a user would, waiting for each stage instead of for time: the
 * source to be ready, the drag to start (Puck marks the canvas), then the drop preview at `to`,
 * nudging the pointer a pixel until each shows, and only then lets go. A press Puck didn't take
 * (it can miss one while it draws the canvas again) is let go outside the canvas, over the left
 * panels, so it isn't a click that adds to the selection, and made again, as a person would. `grabAt` is where to press,
 * as a fraction of the source's width: pressing on an inline-editable element's text selects text
 * instead of dragging. `grabHeight` is the same down its height: a selected element's padding grips
 * sit at the middle of its sides, where a press resizes its padding instead.
 */
export async function drag(
  page: Page,
  from: Locator,
  to: { x: number; y: number },
  grabAt = 0.5,
  grabHeight = 0.5,
): Promise<void> {
  const canvas = page.frameLocator(".editor__canvas iframe");
  let nudge = 0;
  for (let press = 1; ; press++) {
    await dragReady(canvas, from);
    const box = await boxOf(from, "Drag source");
    const x = box.x + box.width * grabAt;
    const y = box.y + box.height * grabHeight;
    await page.mouse.move(x, y);
    await page.mouse.down();
    try {
      await expect
        .poll(
          async () => {
            nudge += 1;
            await page.mouse.move(x + 10 + (nudge % 3), y + 10, { steps: 5 });
            return canvas.locator(DRAGGING).count();
          },
          { message: "The drag didn't start", timeout: 2_000 },
        )
        .toBeGreaterThan(0);
      break;
    } catch (error) {
      // Let go outside the canvas, over the left panels: not the title bar, which moves the window.
      const away = await boxOf(page.getByRole("region", { name: "Left panels" }), "Left panels");
      await page.mouse.move(away.x + away.width / 2, away.y + away.height - 8, { steps: 5 });
      await page.mouse.up();
      if (press === PRESSES) throw error;
    }
  }
  await page.mouse.move(to.x, to.y, { steps: 25 });
  await expect
    .poll(
      async () => {
        nudge += 1;
        // Come down onto the point again, a few pixels at a time, as a hand would: Puck finds the
        // zone nested under the pointer from its movement, which one jump may not give it.
        await page.mouse.move(to.x, to.y - 12, { steps: 2 });
        await page.mouse.move(to.x, to.y + (nudge % 2), { steps: 6 });
        return canvas.locator(DROP_PREVIEW).count();
      },
      { message: "No drop preview where the drag ends", timeout: 10_000 },
    )
    .toBeGreaterThan(0);
  await page.mouse.up();
  await expect(canvas.locator(DRAGGING)).toHaveCount(0);
}

/**
 * A point in the lower part of `target`, centred: dropping there puts the new element after it,
 * and it stays over the target however small the canvas is drawn.
 */
export async function lowerHalf(target: Locator): Promise<{ x: number; y: number }> {
  const box = await boxOf(target, "Drop target");
  return { x: box.x + box.width / 2, y: box.y + box.height * 0.75 };
}

/** A point just below `target`'s bottom edge (or above it, for a negative `offset`), centred. */
export async function below(target: Locator, offset = 3): Promise<{ x: number; y: number }> {
  const box = await boxOf(target, "Drop target");
  return { x: box.x + box.width / 2, y: box.y + box.height + offset };
}
