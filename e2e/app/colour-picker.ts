import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Chooses `hex` with Webforge's colour picker (5.26) whose swatch is `swatch`, as a person types a
 * brand colour's code: opens it, types the code in its hex box, and closes it with **Done**, which
 * chooses the colour once.
 *
 * It waits for the picker to show the code before it closes (#1581, #1628): the hex box holds the
 * typed code from the start, so its value says nothing about whether Enter has been taken. And it
 * closes with Done, a button inside the picker, not a second click on the swatch, which only
 * closes it when Radix tells that click from one outside the picker. On Windows CI the swatch's
 * second click sometimes left the picker open.
 */
export async function chooseColour(page: Page, swatch: Locator, hex: string): Promise<void> {
  await swatch.click();
  const picker = page.getByRole("dialog", { name: "Colour picker" });
  const code = picker.getByRole("textbox", { name: "Hex code" });
  await code.fill(hex);
  await code.press("Enter");
  await expect(code).toHaveValue(hex);
  // Taken: the swatch shows the colour, and says its code to a screen reader.
  await expect(swatch).toHaveAccessibleDescription(new RegExp(`^${hex}\\b`, "i"));
  await picker.getByRole("button", { name: "Done", exact: true }).click();
  await expect(picker).toHaveCount(0);
}
