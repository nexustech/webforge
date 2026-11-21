import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { hoverUntilShown } from "./hover.js";
import { launchDesktopApp, newUserDataDir, removeWhenFree, waitForCanvas } from "./launch.js";

// Command palette and Add panel favourites (1.34, F-ED-26, UX-10, UX-11): Ctrl/Cmd+P finds
// commands, pages to go to and things to add; an Add from it is one undo step; the person's
// favourite sections lead the Add panel, after a restart too.

let app: ElectronApplication;
let page: Page;

const canvas = () => page.frameLocator(".editor__canvas iframe");
const left = () => page.getByRole("region", { name: "Left panels" });
const palette = () => page.getByRole("dialog", { name: "Commands" });
const steps = () => page.locator(".undo-history__step");
const groups = () =>
  left()
    .getByRole("list")
    .filter({ has: page.getByRole("button") });

async function launch(userDataDir?: string) {
  app = await launchDesktopApp(userDataDir === undefined ? {} : { userDataDir });
  page = await app.firstWindow();
  await waitForCanvas(page);
}

test.describe("command palette", () => {
  test.beforeEach(() => launch());
  test.afterEach(() => app.close());

  test("adds a section from the keyboard, as one undo step", async () => {
    await page.keyboard.press("ControlOrMeta+p");
    await page.getByRole("combobox").pressSequentially("add hero");
    await expect(palette().getByRole("option", { name: "Add Hero" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.keyboard.press("Enter");

    await expect(palette()).toBeHidden();
    await expect(canvas().locator(".site-hero")).toHaveCount(1);
    await left().getByRole("tab", { name: "Undo History" }).click();
    await expect(steps().first()).toHaveText("Added Hero");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(canvas().locator(".site-hero")).toHaveCount(0);
  });

  test("goes to a page by its name, and still opens with Ctrl/Cmd+K", async () => {
    await page.keyboard.press("ControlOrMeta+k");
    await page.getByRole("combobox").pressSequentially("page not found");
    await palette().getByRole("option", { name: "Page not found" }).click();

    await expect(canvas().locator("h1")).toHaveText("Sorry, this page doesn't exist");
  });
});

test.describe("section previews", () => {
  test.beforeEach(() => launch());
  test.afterEach(() => app.close());

  test("show a section in the site's theme colours and font (UX-10)", async () => {
    const preview = page.locator('[data-slot="hover-card-content"] > div');
    // Off onto the right panels, which have no section previews.
    await hoverUntilShown(
      left().getByRole("button", { name: "Hero", exact: true }),
      preview,
      page.getByRole("region", { name: "Right panels" }),
    );
    // The canvas shows the page in the site's theme: the preview has the same colours.
    const pageColours = await canvas()
      .locator("body")
      .evaluate((body) => {
        const style = getComputedStyle(body);
        return [style.backgroundColor, style.color];
      });
    expect(pageColours[0]).not.toBe("rgba(0, 0, 0, 0)");
    await expect
      .poll(() =>
        preview.evaluate((host) => {
          const shown = host.shadowRoot?.querySelector(".wf-preview");
          if (shown == null) return [];
          const style = getComputedStyle(shown);
          return [style.backgroundColor, style.color];
        }),
      )
      .toEqual(pageColours);
    // Scaled to a third (#1175), with no space left below the section.
    const heights = await preview.evaluate((host) => [
      host.getBoundingClientRect().height,
      (host.shadowRoot?.querySelector(".wf-preview")?.getBoundingClientRect().height ??
        0) as number,
    ]);
    expect(Math.abs((heights[0] ?? 0) - Math.min(heights[1] ?? 0, 240))).toBeLessThan(1);
    // The site's font: the editor's own is the system's, so only the preview loads Inter.
    await expect
      .poll(() =>
        page.evaluate(async () => {
          await document.fonts.ready;
          return [...document.fonts].some(
            (face) => face.family.replaceAll('"', "") === "Inter" && face.status === "loaded",
          );
        }),
      )
      .toBe(true);
  });
});

test.describe("every section's preview", () => {
  test.beforeEach(() => launch());
  test.afterEach(() => app.close());

  test("is at least 120 px tall and shows what the section holds, and no card is empty (#1175)", async () => {
    const preview = page.locator('[data-slot="hover-card-content"] > div');
    const away = page.getByRole("region", { name: "Right panels" });
    const rows = left().getByRole("list", { name: "All sections" }).getByRole("button");
    const names = await rows.evaluateAll((buttons) =>
      buttons.map((button) => button.textContent?.trim() ?? ""),
    );
    expect(names.length).toBeGreaterThan(20);
    const sizes: Record<string, number> = {};
    for (const name of names) {
      const row = left()
        .getByRole("list", { name: "All sections" })
        .getByRole("button", { name, exact: true });
      // A Section with nothing in it yet has no card at all, rather than an empty one
      // (`section-preview.test.tsx`): nothing to wait for here.
      if (name === "Section") continue;
      await hoverUntilShown(row, preview, away);
      // Drawn, with the section's own words or pictures in it.
      await expect
        .poll(() =>
          preview.evaluate(
            (host) => host.shadowRoot?.querySelector(".wf-preview")?.innerHTML ?? "",
          ),
        )
        .not.toBe("");
      sizes[name] = await preview.evaluate((host) => host.getBoundingClientRect().height);
      // Closed before the next, so its card is never taken for the next one's.
      await away.hover({ position: { x: 20, y: 40 } });
      await expect(preview).toHaveCount(0);
    }
    const short = Object.entries(sizes).filter(([, height]) => height < 119.5);
    expect(short).toEqual([]);
  });
});

test("keeps the person's favourite sections first, after a restart", async () => {
  const userData = newUserDataDir();
  try {
    await launch(userData);
    await left().getByRole("button", { name: "FAQ", exact: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Add to Favourites" }).click();
    await expect(groups().first()).toHaveAccessibleName("Favourites");
    await app.close();

    await launch(userData);
    await expect(groups().first()).toHaveAccessibleName("Favourites");
    // By name: the button also holds the canvas's drag handle, with its own label.
    await expect(groups().first().getByRole("button")).toHaveAccessibleName("FAQ");
  } finally {
    await app.close();
    void removeWhenFree(userData);
  }
});
