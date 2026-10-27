import { request } from "node:http";
import { PREVIEW_STYLESHEET } from "@webforge/pipeline";
import { afterEach, describe, expect, it } from "vitest";
import { createPreviewServer, type PreviewBuild, type PreviewServer } from "./preview-server.js";

const text = new TextEncoder();
const page = (body: string) => text.encode(`<!doctype html><html><body>${body}</body></html>`);

/** A first build of a home page, an About page in a folder, a stylesheet and an image. */
const FIRST: PreviewBuild = {
  type: "previewed",
  full: true,
  changed: [
    { path: "index.html", data: page("Home") },
    { path: "services/about.html", data: page("About") },
    { path: PREVIEW_STYLESHEET, data: text.encode("body{color:red}") },
    { path: "assets/img/cake-640.webp", data: new Uint8Array([1, 2, 3]) },
  ],
  removed: [],
};

let server: PreviewServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

async function started() {
  server = createPreviewServer();
  const port = await server.listen("local");
  return { server, port };
}

/** A request to the server; resolves its status, headers and body. */
function get(port: number, path: string, method = "GET", headers: Record<string, string> = {}) {
  return new Promise<{ status: number; type: string; etag: string; body: string }>(
    (resolve, reject) => {
      const sent = request({ host: "127.0.0.1", port, path, method, headers }, (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            type: String(response.headers["content-type"] ?? ""),
            etag: String(response.headers.etag ?? ""),
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      });
      sent.on("error", reject);
      sent.end();
    },
  );
}

/** The server's event stream, collecting each event as it comes. */
function events(port: number, base: string) {
  const received: { event: string; data: unknown }[] = [];
  let buffer = "";
  const opened = new Promise<() => void>((resolve, reject) => {
    const sent = request(
      { host: "127.0.0.1", port, path: `${base}__webforge/events` },
      (response) => {
        response.on("data", (chunk: Buffer) => {
          buffer += chunk.toString("utf8");
          let end = buffer.indexOf("\n\n");
          while (end !== -1) {
            const block = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            const event = /^event: (.*)$/m.exec(block)?.[1];
            const data = /^data: (.*)$/m.exec(block)?.[1];
            if (event !== undefined && data !== undefined) {
              received.push({ event, data: JSON.parse(data) });
            }
            end = buffer.indexOf("\n\n");
          }
        });
        resolve(() => sent.destroy());
      },
    );
    sent.on("error", reject);
    sent.end();
  });
  return { received, opened };
}

describe("the preview server (3.2)", () => {
  it("listens on this computer only until a phone is asked for", async () => {
    const { server: preview, port } = await started();
    expect(port).toBeGreaterThan(0);
    // The same port again for the same scope.
    expect(await preview.listen("local")).toBe(port);
  });

  it("serves the build's pages under its secret base, with the live reload script", async () => {
    const { server: preview, port } = await started();
    preview.update(FIRST);

    const home = await get(port, preview.base);
    expect(home.status).toBe(200);
    expect(home.type).toBe("text/html; charset=utf-8");
    expect(home.body).toContain("Home");
    expect(home.body).toContain(
      `<script src="${preview.base}__webforge/live.js" data-base="${preview.base}" defer></script></body>`,
    );
    const about = await get(port, `${preview.base}services/about.html`);
    expect(about.body).toContain("About");

    const css = await get(port, `${preview.base}${PREVIEW_STYLESHEET}`);
    expect(css).toMatchObject({ status: 200, type: "text/css; charset=utf-8" });
    expect(css.body).toBe("body{color:red}");
    expect((await get(port, `${preview.base}assets/img/cake-640.webp`)).type).toBe("image/webp");

    const script = await get(port, `${preview.base}__webforge/live.js`);
    expect(script.type).toBe("text/javascript; charset=utf-8");
    expect(script.body).toContain("EventSource");
    // HEAD answers with no body.
    expect(await get(port, preview.base, "HEAD")).toMatchObject({ status: 200, body: "" });
  });

  it("serves nothing but the build's files, and nothing without its base", async () => {
    const { server: preview, port } = await started();
    preview.update(FIRST);

    for (const path of [
      "/index.html",
      "/",
      `/${"0".repeat(32)}/index.html`,
      `${preview.base}missing.html`,
      `${preview.base}..%2f..%2fpackage.json`,
      `${preview.base}%2e%2e/index.html`,
      // The editor's own protocols are never the preview's files.
      `${preview.base}webforge-media://original/${"a".repeat(64)}`,
      `${preview.base}%ZZ`,
    ]) {
      expect((await get(port, path)).status, path).toBe(404);
    }
    expect((await get(port, preview.base, "POST")).status).toBe(405);
  });

  it("holds a page asked for before the first build, and answers it once it's built", async () => {
    const { server: preview, port } = await started();
    let watched = 0;
    preview.onWatch(() => watched++);

    const waiting = get(port, preview.base);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(watched).toBe(1);
    preview.update(FIRST);

    expect((await waiting).body).toContain("Home");
  });

  it("tells a page waiting for the first build at once when the build failed", async () => {
    const { server: preview, port } = await started();
    const waiting = get(port, preview.base);
    await new Promise((resolve) => setTimeout(resolve, 50));

    preview.failed();

    expect(await waiting).toMatchObject({
      status: 503,
      body: "The preview isn't ready yet. Reload this page in a moment.",
    });
  });

  it("tells the browsers what changed: the stylesheet alone, pages, anything else", async () => {
    const { server: preview, port } = await started();
    preview.update(FIRST);
    const stream = events(port, preview.base);
    const stop = await stream.opened;
    expect(preview.watching()).toBe(1);
    const next = (count: number) =>
      expect.poll(() => stream.received.length, { timeout: 2000 }).toBe(count);

    preview.update({
      type: "previewed",
      full: false,
      changed: [{ path: PREVIEW_STYLESHEET, data: text.encode("body{color:blue}") }],
      removed: [],
    });
    await next(1);
    preview.update({
      type: "previewed",
      full: false,
      changed: [{ path: "services/about.html", data: page("About us") }],
      removed: [],
    });
    await next(2);
    preview.update({
      type: "previewed",
      full: false,
      changed: [{ path: "assets/img/cake-1280.webp", data: new Uint8Array([4]) }],
      removed: ["assets/img/cake-640.webp"],
    });
    await next(3);
    // Nothing changed: nothing to tell.
    preview.update({ type: "previewed", full: false, changed: [], removed: [] });
    preview.show("services/about.html");
    await next(4);

    expect(stream.received).toEqual([
      { event: "css", data: { href: PREVIEW_STYLESHEET } },
      { event: "reload", data: { pages: ["services/about.html"], all: false } },
      { event: "reload", data: { pages: [], all: true } },
      { event: "show", data: { page: "services/about.html" } },
    ]);
    // The new files are served, the removed one isn't.
    expect((await get(port, `${preview.base}${PREVIEW_STYLESHEET}`)).body).toBe("body{color:blue}");
    expect((await get(port, `${preview.base}assets/img/cake-640.webp`)).status).toBe(404);

    stop();
    await expect.poll(() => preview.watching(), { timeout: 2000 }).toBe(0);
  });

  it("replaces every file with a full build, as a new worker's first", async () => {
    const { server: preview, port } = await started();
    preview.update(FIRST);
    preview.update({
      type: "previewed",
      full: true,
      changed: [{ path: "index.html", data: page("Again") }],
      removed: [],
    });

    expect((await get(port, preview.base)).body).toContain("Again");
    expect((await get(port, `${preview.base}services/about.html`)).status).toBe(404);
  });

  it("lets the browser keep a file until it changes: a reload fetches only what did", async () => {
    const { server: preview, port } = await started();
    preview.update(FIRST);
    const css = `${preview.base}${PREVIEW_STYLESHEET}`;
    const { etag } = await get(port, css);
    expect(etag).toMatch(/^"\d+"$/);

    expect(await get(port, css, "GET", { "If-None-Match": etag })).toMatchObject({
      status: 304,
      body: "",
    });
    preview.update({
      type: "previewed",
      full: false,
      changed: [{ path: PREVIEW_STYLESHEET, data: text.encode("body{color:blue}") }],
      removed: [],
    });
    expect(await get(port, css, "GET", { "If-None-Match": etag })).toMatchObject({
      status: 200,
      body: "body{color:blue}",
    });
  });

  it("stops listening when closed", async () => {
    const { server: preview, port } = await started();
    preview.update(FIRST);
    await preview.close();
    server = undefined;

    await expect(get(port, preview.base)).rejects.toThrow();
  });
});
