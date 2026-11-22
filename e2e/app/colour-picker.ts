import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Chooses `hex` with Webforge's colour picker (5.26) whose swatch is `swatch`, as a person types a
 * brand colour's code: opens it, types the code in its hex box, and closes it from the swatch,
 * which chooses the colour once.
 */
export async function chooseColour(page: Page, swatch: Locator, hex: string): Promise<void> {
  await swatch.click();
  const picker = page.getByRole("dialog", { name: "Colour picker" });
  const code = picker.getByRole("textbox", { name: "Hex code" });
  await code.fill(hex);
  await code.press("Enter");
  await expect(code).toHaveValue(hex);
  await swatch.click();
  await expect(picker).toHaveCount(0);
}
