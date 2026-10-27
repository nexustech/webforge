import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { expect, test } from "@playwright/test";
import { THEMED_SITE_DIR } from "./exported-site.js";

// Changing one's mind about cookies (#539, B7) on the themed export (export.setup.ts), served over
// http as a host would serve it: from disk Google's script never loads, so there would be nothing
// to stop. Google's address answers with an empty script, counted; every other address outside the
// site is blocked.

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
};

let server: Server;
let origin = "";

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const path = normalize(new URL(request.url ?? "/", "http://site").pathname.slice(1));
    // Only files of the export: nothing above its folder.
    if (path.split(sep).includes("..")) {
      response.writeHead(403).end();
      return;
    }
    readFile(join(THEMED_SITE_DIR, path === "." ? "index.html" : path)).then(
      (body) => {
        const type = TYPES[extname(path)] ?? "application/octet-stream";
        response.writeHead(200, { "content-type": type }).end(body);
      },
      () => response.writeHead(404).end(),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === "object" && address !== null ? address.port : 0}`;
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test("Cookie settings, then Decline after accepting: Google's requests stop and the choice is kept (#539)", async ({
  context,
  page,
}) => {
  const google: string[] = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) {
      await route.continue();
    } else if (/(^|\.)(googletagmanager|google-analytics)\.com$/.test(url.hostname)) {
      google.push(url.href);
      await route.fulfill({ contentType: "text/javascript", body: "" });
    } else {
      await route.abort();
    }
  });
  await page.goto(`${origin}/index.html`);
  const banner = page.getByRole("region", { name: "Cookies" });

  // Nothing from Google before the visitor accepts; Google's script once they do.
  await expect(banner).toBeVisible();
  expect(google).toEqual([]);
  await banner.getByRole("button", { name: "Accept all" }).click();
  await expect
    .poll(() => google)
    .toEqual(["https://www.googletagmanager.com/gtag/js?id=G-ABC123DEF4"]);

  // Cookie settings in the Footer reopens the banner; Decline starts a fresh page without it.
  await page.locator("footer").getByRole("button", { name: "Cookie settings" }).click();
  await expect(banner).toBeVisible();
  await Promise.all([
    page.waitForEvent("load"),
    banner.getByRole("button", { name: "Decline" }).click(),
  ]);
  await expect(banner).toBeHidden();

  // The choice is kept, on this page and the next: Google's script doesn't load again.
  await page.goto(`${origin}/about.html`);
  await page.waitForLoadState("networkidle");
  await expect(banner).toBeHidden();
  expect(await page.evaluate(() => window.localStorage.getItem("webforge-consent"))).toBe("denied");
  expect(google).toHaveLength(1);
});
