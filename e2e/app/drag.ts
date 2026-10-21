import { expect, type Locator, type Page } from "@playwright/test";

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

/**
 * Drags with real mouse events, in small steps, as a user would. `grabAt` is where to press, as a
 * fraction of the source's width: pressing on an inline-editable element's text selects text
 * instead of dragging the element.
 */
export async function drag(
  page: Page,
  from: Locator,
  to: { x: number; y: number },
  grabAt = 0.5,
): Promise<void> {
  const box = await boxOf(from, "Drag source");
  const x = box.x + box.width * grabAt;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 10, y + 10, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 25 });
  await page.mouse.move(to.x, to.y + 1, { steps: 2 });
  await page.mouse.up();
}

/** A point just below `target`'s bottom edge (or above it, for a negative `offset`), centred. */
export async function below(target: Locator, offset = 3): Promise<{ x: number; y: number }> {
  const box = await boxOf(target, "Drop target");
  return { x: box.x + box.width / 2, y: box.y + box.height + offset };
}
