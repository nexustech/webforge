import { expect, type Locator } from "@playwright/test";

/**
 * Points at `target` until `shown` (its tooltip or hover card) is visible, as a person moves the
 * pointer off and back on when nothing came up. A tooltip or card opens on the pointer moving onto
 * its trigger: a trigger drawn afresh under a still pointer, as a busy computer can leave it after
 * the window opens, never hears that move, and the card never came up (#1147). Each attempt waits
 * for the card, not for a time. The pointer comes off onto `off`, a part of the window that opens
 * nothing like `shown` itself.
 */
export async function hoverUntilShown(
  target: Locator,
  shown: Locator,
  off: Locator,
): Promise<void> {
  await expect(async () => {
    await off.hover({ position: { x: 20, y: 40 } });
    await target.hover();
    await expect(shown).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 45_000 });
}
