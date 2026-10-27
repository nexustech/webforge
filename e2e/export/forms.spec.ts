import { expect, type Page, test } from "@playwright/test";
import { themedPageUrl } from "./exported-site.js";

// Forms (3.7, B3, B6) on the themed export (export.setup.ts), which sends to Web3Forms with the
// site's web address: opened from disk with the network blocked, nothing leaves the computer until
// a form is sent, and then only to the form service, as a plain HTML POST.

let requests: { url: string; method: string }[] = [];

test.beforeEach(async ({ context }) => {
  requests = [];
  await context.route(/^(?!file:)/, async (route) => {
    requests.push({ url: route.request().url(), method: route.request().method() });
    await route.abort();
  });
});

/** About's Contact form, the consent banner out of its way, filled in. */
async function filledContactForm(page: Page) {
  await page.goto(themedPageUrl("about.html"));
  await page
    .getByRole("region", { name: "Cookies" })
    .getByRole("button", { name: "Decline" })
    .click();
  const form = page.getByRole("form", { name: "Contact form" });
  await form.getByLabel("Name").fill("Sam");
  await form.getByLabel("Email address").fill("sam@example.com");
  await form.getByLabel("Message").fill("A birthday cake for Saturday, please.");
  return form;
}

test("sends to the service with its own honeypot, and its thank-you page's address (3.7)", async ({
  page,
}) => {
  await page.goto(themedPageUrl("about.html"));
  const form = page.getByRole("form", { name: "Contact form" });

  await expect(form).toHaveAttribute("action", "https://api.web3forms.com/submit");
  await expect(form).toHaveAttribute("method", "post");
  await expect(form.locator('input[name="redirect"]')).toHaveValue(
    "https://rosas-bakery.example/thank-you.html",
  );
  // Web3Forms' honeypot: a checkbox no visitor sees or reaches.
  await expect(form.locator('input[name="botcheck"]')).toBeHidden();
  expect(requests).toEqual([]);

  // The thank-you page the export made, with the site's Header and Footer.
  await page.goto(themedPageUrl("thank-you.html"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thank you");
  await page.getByRole("link", { name: "Back to the home page" }).click();
  await expect(page).toHaveURL(/\/index\.html$/);
});

test("holds a form sent in the page's first seconds, then sends it once, at 3 s (B6)", async ({
  page,
}) => {
  // The page's clock stands still while the test fills the form, however long that takes.
  const opened = new Date("2026-10-27T10:00:00Z");
  await page.clock.install({ time: opened });
  await page.clock.pauseAt(opened);
  const form = await filledContactForm(page);
  const posts = () => requests.filter((request) => request.url.includes("web3forms"));

  // Sent the moment the page opened, as a browser's autofill can: held, and the visitor told.
  await form.getByRole("button", { name: "Send message" }).click();
  await expect(form.getByRole("status")).toHaveText("Sending…");
  expect(posts()).toEqual([]);
  // A second press meanwhile sends nothing more.
  await page.clock.fastForward(1_000);
  await form.getByRole("button", { name: "Send message" }).click();
  expect(posts()).toEqual([]);

  // At 3 s it goes, plainly, to the service, once.
  await page.clock.fastForward(2_000);
  await expect.poll(posts).toEqual([{ url: "https://api.web3forms.com/submit", method: "POST" }]);
  requests = [];
});
