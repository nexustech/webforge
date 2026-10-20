// Serves the static Storybook build (packages/editor-ui/storybook-static) on 127.0.0.1 for the
// visual tests. Storybook loads ES modules, which browsers refuse from file://, hence a server.
//
// Usage: node visual/serve-storybook.ts [port]   (run from e2e/; playwright.visual.config.ts does)

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "../../packages/editor-ui/storybook-static");
const PORT = Number(process.argv[2] ?? 6107);

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

if (!existsSync(join(ROOT, "index.json"))) {
  console.error(
    `No Storybook build in ${ROOT}. Run: pnpm --filter @webforge/editor-ui build-storybook`,
  );
  process.exit(1);
}

createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const file = normalize(join(ROOT, path.endsWith("/") ? `${path}index.html` : path));
  // Only files inside the build; never anything above it.
  if (
    !(file === ROOT || file.startsWith(ROOT + sep)) ||
    !existsSync(file) ||
    !statSync(file).isFile()
  ) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Storybook build served on http://127.0.0.1:${PORT}`);
});
