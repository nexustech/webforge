import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";

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
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

/** An exported site served over http on this computer, as a host would serve it. */
export type ServedSite = {
  /** `http://127.0.0.1:<port>`. */
  readonly origin: string;
  close(): Promise<void>;
};

/**
 * Serves the export in `dir` on a free port of `127.0.0.1`, only its own files. A missing address
 * gets `404.html` with status 404, as hosts serve a site's "Page not found" page (F-ED-20), at any
 * depth.
 */
export async function serveSite(dir: string): Promise<ServedSite> {
  const server = createServer((request, response) => {
    const path = normalize(new URL(request.url ?? "/", "http://site").pathname.slice(1));
    // Only files of the export: nothing above its folder.
    if (path.split(sep).includes("..")) {
      response.writeHead(403).end();
      return;
    }
    readFile(join(dir, path === "." ? "index.html" : path)).then(
      (body) => {
        const type = TYPES[extname(path)] ?? "application/octet-stream";
        response.writeHead(200, { "content-type": type }).end(body);
      },
      () =>
        readFile(join(dir, "404.html")).then(
          (body) => response.writeHead(404, { "content-type": TYPES[".html"] }).end(body),
          () => response.writeHead(404).end(),
        ),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
