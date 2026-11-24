import { expect, type FrameLocator, type Locator, type Page } from "@playwright/test";
import {
  COMPONENT,
  COMPONENT_DROP_ZONE,
  DISABLED_ATTRIBUTE,
  DRAGGING,
  DROP_PREVIEW,
} from "@webforge/engine/puck-dom";

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

/** How many times {@link drag} presses before it gives up on the drag starting. */
const PRESSES = 3;

/**
 * Whether Puck can start a drag from `from` now: no drag is still ending (dnd-kit ignores a press
 * until its last one is idle), and the element it is in may be dragged (Puck marks one that may
 * not, as while it is drawn again, with DISABLED_ATTRIBUTE). Puck marks the canvas while something is
 * being dragged over it (DRAGGING), and where the drop would land (DROP_PREVIEW).
 */
async function dragReady(canvas: FrameLocator, from: Locator): Promise<void> {
  await expect(canvas.locator(DRAGGING)).toHaveCount(0);
  await expect
    .poll(
      () =>
        from.evaluate(
          (element, { component, disabled }) =>
            // A source outside the canvas (the Add panel's items) has no element of Puck's.
            element.closest(component)?.hasAttribute(disabled) ?? false,
          { component: COMPONENT, disabled: DISABLED_ATTRIBUTE },
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
 *
 * `to` is a point, or what finds it: found again at every try, so a canvas that moves once the drag
 * is under way is followed. With `into`, the drop preview must be inside it before the drag lets
 * go: on a busy computer the preview can still be in a zone the pointer crossed on its way (#1336).
 */
export async function drag(
  page: Page,
  from: Locator,
  to: { x: number; y: number } | (() => Promise<{ x: number; y: number }>),
  grabAt = 0.5,
  grabHeight = 0.5,
  into?: Locator,
): Promise<void> {
  const target = () => (typeof to === "function" ? to() : Promise.resolve(to));
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
  const first = await target();
  await page.mouse.move(first.x, first.y, { steps: 25 });
  try {
    await expect
      .poll(
        async () => {
          nudge += 1;
          const at = await target();
          // Come down onto the point again, a few pixels at a time, as a hand would: Puck finds
          // the zone nested under the pointer from its movement, which one jump may not give it.
          await page.mouse.move(at.x, at.y - 12, { steps: 2 });
          await page.mouse.move(at.x, at.y + (nudge % 2), { steps: 6 });
          return (into === undefined ? canvas : into).locator(DROP_PREVIEW).count();
        },
        { message: "No drop preview where the drag ends", timeout: 10_000 },
      )
      .toBeGreaterThan(0);
  } catch (error) {
    // Say where the preview is instead, and which zone is under the pointer (#1393).
    const at = await target();
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n${await whereDropping(page, at)}`,
    );
  }
  await page.mouse.up();
  await expect(canvas.locator(DRAGGING)).toHaveCount(0);
}

/**
 * Where a drag would drop when it isn't where the test aimed (#1393): the zone each drop preview is
 * in, and the zones under the point `at`, innermost last, each with its box on the page.
 */
async function whereDropping(page: Page, at: { x: number; y: number }): Promise<string> {
  const canvas = page.frameLocator(".editor__canvas iframe");
  const zoneOf = (locator: Locator) =>
    locator.evaluate(
      (element, zone) => element.closest(zone)?.getAttribute("data-puck-dropzone") ?? "(none)",
      COMPONENT_DROP_ZONE,
    );
  const round = (box: Box | null) =>
    box === null
      ? "hidden"
      : `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}×${Math.round(box.height)}`;
  const previews: string[] = [];
  for (const preview of await canvas.locator(DROP_PREVIEW).all()) {
    previews.push(`${await zoneOf(preview)} at ${round(await preview.boundingBox())}`);
  }
  const under: string[] = [];
  for (const zone of await canvas.locator(COMPONENT_DROP_ZONE).all()) {
    const box = await zone.boundingBox();
    if (
      box !== null &&
      at.x >= box.x &&
      at.x <= box.x + box.width &&
      at.y >= box.y &&
      at.y <= box.y + box.height
    ) {
      under.push(`${await zone.getAttribute("data-puck-dropzone")} at ${round(box)}`);
    }
  }
  return [
    `Pointer at ${Math.round(at.x)},${Math.round(at.y)}.`,
    `Drop previews: ${previews.length === 0 ? "none" : previews.join("; ")}.`,
    `Zones under the pointer: ${under.length === 0 ? "none" : under.join("; ")}.`,
  ].join("\n");
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
