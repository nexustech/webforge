import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { describe, expect, it } from "vitest";
import { APP_SCHEME, appPageUrl, createAppResponder } from "./app-scheme.js";

describe("the app's scheme (#652, S5)", () => {
  const tempDir = tempDirFactory();

  /** An `out` folder: the renderer's build, and a secret beside it that must never be served. */
  function setUp() {
    const out = tempDir();
    const renderer = join(out, "renderer");
    mkdirSync(join(renderer, "assets"), { recursive: true });
    writeFileSync(join(renderer, "index.html"), "<!doctype html><title>Editor</title>");
    writeFileSync(join(renderer, "assets", "index-B4x_9z-Q.js"), "console.log(1);");
    writeFileSync(join(renderer, "assets", "index-C1.css"), "body{}");
    writeFileSync(join(renderer, ".env"), "SECRET=1");
    writeFileSync(join(renderer, "notes.md"), "# notes");
    writeFileSync(join(out, "secret.html"), "<p>secret</p>");
    const respond = createAppResponder(renderer);
    return (url: string, method = "GET") => respond({ url, method });
  }

  it("names the app's pages on its own host", () => {
    expect(appPageUrl("index.html")).toBe(`${APP_SCHEME}://editor/index.html`);
    expect(appPageUrl("help.html")).toBe("webforge-app://editor/help.html");
  });

  it("serves the renderer's files with their types, whatever query the page reads", async () => {
    const respond = setUp();

    const page = await respond("webforge-app://editor/index.html");
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(page.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await page.text()).toContain("<title>Editor</title>");

    const script = await respond("webforge-app://editor/assets/index-B4x_9z-Q.js");
    expect(script.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(await script.text()).toBe("console.log(1);");
    const style = await respond("webforge-app://editor/assets/index-C1.css");
    expect(style.headers.get("content-type")).toBe("text/css; charset=utf-8");

    expect((await respond("webforge-app://editor/index.html?page=export&theme=dark")).ok).toBe(
      true,
    );
    expect((await respond("webforge-app://editor/index.html#/pages")).ok).toBe(true);
  });

  it.each([
    ["a file outside the renderer's folder", "webforge-app://editor/../secret.html"],
    ["an escaped way out", "webforge-app://editor/%2e%2e/secret.html"],
    ["an escaped slash", "webforge-app://editor/assets%2Findex-C1.css"],
    ["a backslash", "webforge-app://editor/assets\\index-C1.css"],
    ["a hidden file", "webforge-app://editor/.env"],
    ["a file of another type", "webforge-app://editor/notes.md"],
    ["a folder", "webforge-app://editor/assets"],
    ["a file that isn't there", "webforge-app://editor/missing.js"],
    // Windows opens these as devices, in any folder: never read (#652 review).
    ["a Windows device name", "webforge-app://editor/con.js"],
    ["a device name in capitals", "webforge-app://editor/NUL.css"],
    ["a folder with a device name", "webforge-app://editor/aux/x.js"],
    ["another host", "webforge-app://other/index.html"],
    ["no host", "webforge-app:///index.html"],
    ["another scheme", "file:///index.html"],
  ])("serves nothing for %s", async (_name, url) => {
    const respond = setUp();
    expect((await respond(url)).status).toBe(404);
  });

  it("answers nothing but GET", async () => {
    const respond = setUp();
    expect((await respond("webforge-app://editor/index.html", "POST")).status).toBe(404);
  });
});
