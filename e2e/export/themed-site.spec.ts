import { expect, test } from "@playwright/test";
import { themedPageUrl } from "./exported-site.js";

// The fixture site exported in a theme of its own (#423, export.setup.ts): square, large, outline
// buttons, strong shadows and links underlined only on hover, each as the browser draws it.

test("draws its buttons, shadows and links as the theme says (#423)", async ({ page }) => {
  await page.goto(themedPageUrl("index.html"));

  // A main button at the default size: outline, square and the theme's large height.
  const button = await page
    .locator("a.btn.btn-primary:not(.btn-xs, .btn-sm, .btn-lg, .btn-xl, .wf-filled)")
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        border: style.borderTopColor,
        color: style.color,
        height: style.height,
        radius: style.borderTopLeftRadius,
      };
    });
  expect(button.background).toBe("rgba(0, 0, 0, 0)");
  expect(button.border).toBe(button.color);
  expect(button.height).toBe("48px");
  expect(button.radius).toBe("0px");

  // A Button set to Filled stays filled (PH2-14).
  const filled = await page
    .getByRole("link", { name: "Call us" })
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(filled).not.toBe("rgba(0, 0, 0, 0)");

  // A strong shadow: darker than Tailwind's own (0.1).
  const shadow = await page
    .locator(".shadow-lg")
    .first()
    .evaluate((element) => getComputedStyle(element).boxShadow);
  expect(shadow).toMatch(/0\.2\)/);

  // A link in a Reversed section: in that section's main colour, not the page's.
  const colours = await page.getByRole("link", { name: "our menu" }).evaluate((link) => {
    const section = link.closest("[data-theme]");
    const probe = document.createElement("span");
    probe.style.color = "var(--color-primary)";
    section?.append(probe);
    const sectionPrimary = getComputedStyle(probe).color;
    probe.remove();
    return { link: getComputedStyle(link).color, sectionPrimary };
  });
  expect(colours.link).toBe(colours.sectionPrimary);
  const pageLink = await page
    .getByRole("link", { name: "our story" })
    .evaluate((link) => getComputedStyle(link).color);
  expect(colours.link).not.toBe(pageLink);

  // A link in running text: not underlined until it's hovered or focused.
  const link = page.getByRole("link", { name: "our story" });
  expect(await link.evaluate((element) => getComputedStyle(element).textDecorationLine)).toBe(
    "none",
  );
});
