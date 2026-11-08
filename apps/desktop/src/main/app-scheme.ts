import { readFile } from "node:fs/promises";
import { extname, join, sep } from "node:path";

/**
 * The scheme the packaged editor and Help pages load from (#652, security review S5, S33, ADR
 * 0023): `webforge-app://editor/index.html`, never `file://`. A page of the app's own scheme can't
 * read the computer's files as a `file:` page could, and its origin, host included, is the app's
 * alone (S7).
 */
export const APP_SCHEME = "webforge-app";

/** The one host of {@link APP_SCHEME}: the folder of the built renderer. */
const APP_HOST = "editor";

/** How the scheme is registered before "ready": a standard, secure origin that may `fetch`. */
export const APP_SCHEME_PRIVILEGES = {
  scheme: APP_SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true },
} as const;

/** The address of the renderer's page `file` (`index.html`, `help.html`). */
export function appPageUrl(file: string): string {
  return `${APP_SCHEME}://${APP_HOST}/${file}`;
}

/** The types of the files the renderer's build holds, by extension. */
const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

/**
 * A file of the renderer's build, as its address names it: folders and a file of plain names, then
 * a query or fragment the page reads itself. The raw URL is matched, never a parsed one: parsing
 * would resolve `..` before any check saw it, and an escaped character never names a file.
 */
const APP_FILE = new RegExp(
  `^${APP_SCHEME}://${APP_HOST}/((?:[A-Za-z0-9_-][A-Za-z0-9_.-]*/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*)(?:[?#].*)?$`,
);

/**
 * Answers {@link APP_SCHEME}'s requests with files of `rendererDir` (`out/renderer`) only: a name
 * that leaves it, starts with a dot, or isn't one of the build's types gets a 404, as does
 * anything but GET. Nothing else of the computer's is ever served (S5).
 */
export function createAppResponder(
  rendererDir: string,
  read: (path: string) => Promise<Uint8Array> = readFile,
): (request: { readonly url: string; readonly method: string }) => Promise<Response> {
  const notFound = () => new Response(null, { status: 404 });
  const root = rendererDir.endsWith(sep) ? rendererDir : `${rendererDir}${sep}`;
  return async ({ url, method }) => {
    const name = APP_FILE.exec(url)?.[1];
    if (method !== "GET" || name === undefined) return notFound();
    const type = TYPES[extname(name).toLowerCase()];
    const path = join(root, ...name.split("/"));
    if (type === undefined || !path.startsWith(root)) return notFound();
    try {
      const data = await read(path);
      return new Response(new Uint8Array(data), {
        headers: { "content-type": type, "x-content-type-options": "nosniff" },
      });
    } catch {
      return notFound();
    }
  };
}
