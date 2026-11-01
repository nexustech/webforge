import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { t } from "@webforge/i18n";
import { PREVIEW_STYLESHEET } from "@webforge/pipeline";
import { THEME_VALUES_MARKER } from "@webforge/themes";
import type { PreviewOutcome } from "../shared/export-worker-protocol.js";
import { LIVE_RELOAD_SCRIPT } from "./preview-live-reload.js";

/** A build the preview shows: the worker's answer, the files that changed and those gone. */
export type PreviewBuild = Extract<PreviewOutcome, { type: "previewed" }>;

/** Where the server listens: this computer only, or the local network too, for a phone. */
export type PreviewScope = "local" | "network";

/**
 * The preview server (3.2, F-PV-1): serves the open site's latest preview build from memory, and
 * tells the browsers showing it what changed, over server-sent events.
 */
export type PreviewServer = {
  /**
   * Listens on `scope`, once for each, resolving the port it listens on there: this computer
   * (`127.0.0.1`), or for a phone the one address `host` on the local network, never every
   * network the computer is on. A new `host` for the network (another Wi-Fi) listens there instead.
   */
  listen(scope: PreviewScope, host?: string): Promise<number>;
  /** Stops listening on `scope`, closing its connections: Stop Phone Preview. */
  stop(scope: PreviewScope): Promise<void>;
  /**
   * The path every URL on this computer starts with: a secret, so a site another tab opens can't
   * read the preview.
   */
  readonly base: string;
  /**
   * The path every URL a phone opens starts with: another secret, a new one each time the phone's
   * listener starts (S9), so an address given out before opens nothing. None while it's stopped.
   */
  phoneBase(): string | undefined;
  /**
   * Calls `listener` when the phone's listener stops by itself: no phone asked for anything, nor
   * kept a page open, for a while (S9).
   */
  onPhoneStopped(listener: () => void): void;
  /** Takes a build: its files are served from now on, and the browsers told what changed. */
  update(build: PreviewBuild): void;
  /** Takes the editor to `page` (`about.html`): the browsers showing another page go there. */
  show(page: string): void;
  /** A build failed: pages waiting for the first one are told it isn't ready, at once. */
  failed(): void;
  /** How many browsers are showing the preview now. */
  watching(): number;
  /** Called when a browser starts showing the preview, so the latest edits can be built. */
  onWatch(listener: () => void): void;
  /** Stops listening, closing every connection. */
  close(): Promise<void>;
};

/** Content types by extension; anything else is served as bytes. */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json",
  webmanifest: "application/manifest+json",
  xml: "application/xml",
  txt: "text/plain; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff2: "font/woff2",
  pdf: "application/pdf",
};

const contentTypeOf = (path: string) =>
  CONTENT_TYPES[path.slice(path.lastIndexOf(".") + 1).toLowerCase()] ?? "application/octet-stream";

/**
 * Sent with every answer: never kept, never sniffed, the preview's address never passed on. The
 * built files are kept by this browser only, and checked each time ({@link FILE_HEADERS}).
 */
const COMMON_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
} as const;

/**
 * A built file's: kept by this browser only (`private`, never a proxy's cache), and checked with
 * the server each time it's used (its version as its ETag), so a reloaded page fetches only what
 * changed: a 304 for the rest.
 */
const FILE_HEADERS = { ...COMMON_HEADERS, "Cache-Control": "private, no-cache" } as const;

/**
 * The theme's values `after` ends with, if they are all that changed from `before`: both
 * stylesheets the same up to {@link THEME_VALUES_MARKER} (3.2). A browser takes them in place,
 * with nothing to download.
 */
export function changedValues(before: string, after: string): string | undefined {
  const from = before.lastIndexOf(THEME_VALUES_MARKER);
  const to = after.lastIndexOf(THEME_VALUES_MARKER);
  if (from === -1 || to === -1 || before.slice(0, from) !== after.slice(0, to)) return undefined;
  return after.slice(to);
}

/** How long a page asked for before the first build waits for it before giving up. */
const FIRST_BUILD_WAIT_MS = 120_000;

/** How often an open event stream is told the server is still there (a phone may drop it). */
const KEEP_ALIVE_MS = 20_000;

/** How long the phone's listener stays on with no request and no page open on it (S9). */
const PHONE_IDLE_MS = 10 * 60_000;

/** A new secret base path: `/<32 hex digits>/`. */
const newBase = () => `/${randomBytes(16).toString("hex")}/`;

/** A listener: its server, port and address, the base its URLs start with, its idle timer. */
type Listener = {
  readonly server: Server;
  readonly port: Promise<number>;
  readonly host: string;
  readonly base: string;
  idle?: ReturnType<typeof setTimeout>;
};

/**
 * The `Host` a request to a listener on `address` and `port` may name (S24): its own address, and
 * on this computer `localhost` too. A page elsewhere that points its own name at the preview's
 * address (DNS rebinding) names its own, and is refused before the base is looked at.
 */
const hostsFor = (scope: PreviewScope, address: string, port: number) =>
  scope === "local" ? [`${address}:${port}`, `localhost:${port}`] : [`${address}:${port}`];

/**
 * `html` with the live reload script before its `</body>`, or at its end: it follows the editor,
 * swapping the stylesheet in place, reloading a changed page or going to the page shown.
 */
function withLiveReload(html: string, base: string): string {
  const tag = `<script src="${base}__webforge/live.js" data-base="${base}" defer></script>`;
  const at = html.toLowerCase().lastIndexOf("</body>");
  return at === -1 ? `${html}${tag}` : `${html.slice(0, at)}${tag}${html.slice(at)}`;
}

/**
 * The preview server (3.2). It serves only the files of the latest build, by their exact paths,
 * under a secret base path (`/<32 hex digits>/`), so a site another tab opens can't read the
 * preview, nor a device on the network that wasn't given its link; and nothing from disk. Each
 * listener has its own base, the phone's a new one each time it starts, and answers only requests
 * naming its own address (S9, S24). The phone's stops by itself after `phoneIdleMs` unused. Pages
 * get the live reload script; `__webforge/events` is the stream of what changed. Until the first
 * build, a page asked for waits for it.
 */
export function createPreviewServer(
  options: { readonly phoneIdleMs?: number } = {},
): PreviewServer {
  const phoneIdleMs = options.phoneIdleMs ?? PHONE_IDLE_MS;
  const base = newBase();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let files = new Map<string, Uint8Array>();
  // Each file's version, its ETag: a number that only ever goes up while the server runs.
  const versions = new Map<string, number>();
  let version = 0;
  let built = false;
  /** The pages asked for before the first build, each answered with it, or as not ready. */
  const waiting = new Set<(ready: boolean) => void>();
  /** The open event streams, each with the listener it came through. */
  const streams = new Map<ServerResponse, Listener>();
  const watchers = new Set<() => void>();
  const phoneStopped = new Set<() => void>();
  const servers = new Map<PreviewScope, Listener>();

  /** Stops `listener`, closing every connection to it. */
  const closeServer = (listener: Listener) =>
    new Promise<void>((resolve) => {
      clearTimeout(listener.idle);
      listener.server.close(() => resolve());
      listener.server.closeAllConnections();
    });

  /**
   * (Re)starts the phone's idle timer: when it runs out with no page open through it, the phone's
   * listener stops, and those listening are told.
   */
  const stillUsed = (phone: Listener) => {
    clearTimeout(phone.idle);
    phone.idle = setTimeout(() => {
      if (servers.get("network") !== phone) return;
      if ([...streams.values()].includes(phone)) {
        stillUsed(phone);
        return;
      }
      servers.delete("network");
      void closeServer(phone).then(() => {
        for (const listener of phoneStopped) listener();
      });
    }, phoneIdleMs);
  };

  const send = (event: string, data: unknown) => {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const stream of streams.keys()) stream.write(message);
  };

  const notReady = (response: ServerResponse) => {
    response.writeHead(503, { ...COMMON_HEADERS, "Content-Type": "text/plain; charset=utf-8" });
    response.end(t("preview.notReady"));
  };

  const notFound = (response: ServerResponse) => {
    response.writeHead(404, { ...COMMON_HEADERS, "Content-Type": "text/plain; charset=utf-8" });
    response.end(t("preview.notFound"));
  };

  const serveFile = (
    path: string,
    listener: Listener,
    request: IncomingMessage,
    response: ServerResponse,
    head: boolean,
  ) => {
    const data = files.get(path);
    if (data === undefined) {
      notFound(response);
      return;
    }
    const etag = `"${versions.get(path) ?? 0}"`;
    if (request.headers["if-none-match"] === etag) {
      response.writeHead(304, { ...FILE_HEADERS, ETag: etag });
      response.end();
      return;
    }
    const type = contentTypeOf(path);
    const body = type.startsWith("text/html")
      ? encoder.encode(withLiveReload(decoder.decode(data), listener.base))
      : data;
    response.writeHead(200, {
      ...FILE_HEADERS,
      ETag: etag,
      "Content-Type": type,
      "Content-Length": body.byteLength,
    });
    response.end(head ? undefined : body);
  };

  const openStream = (listener: Listener, request: IncomingMessage, response: ServerResponse) => {
    response.writeHead(200, {
      ...COMMON_HEADERS,
      "Content-Type": "text/event-stream; charset=utf-8",
      Connection: "keep-alive",
    });
    // A dropped stream comes back after a second. It isn't told the page shown: a visitor who
    // followed a link to another page stays there until the editor shows another.
    response.write("retry: 1000\n\n");
    streams.set(response, listener);
    const alive = setInterval(() => response.write(": alive\n\n"), KEEP_ALIVE_MS);
    request.on("close", () => {
      clearInterval(alive);
      streams.delete(response);
    });
    for (const watcher of watchers) watcher();
  };

  const handle = (
    scope: PreviewScope,
    listener: Listener,
    request: IncomingMessage,
    response: ServerResponse,
  ) => {
    const { port } = listener.server.address() as AddressInfo;
    const host = request.headers.host?.toLowerCase() ?? "";
    if (!hostsFor(scope, listener.host, port).includes(host)) {
      response.writeHead(421, { ...COMMON_HEADERS, "Content-Type": "text/plain; charset=utf-8" });
      response.end();
      return;
    }
    const head = request.method === "HEAD";
    if (request.method !== "GET" && !head) {
      response.writeHead(405, { ...COMMON_HEADERS, Allow: "GET, HEAD" });
      response.end();
      return;
    }
    const url = new URL(request.url ?? "/", "http://preview");
    if (!url.pathname.startsWith(listener.base)) {
      notFound(response);
      return;
    }
    // A request with the phone's secret: a phone is still using it.
    if (scope === "network") stillUsed(listener);
    let path: string;
    try {
      path = decodeURIComponent(url.pathname.slice(listener.base.length));
    } catch {
      notFound(response);
      return;
    }
    if (path === "__webforge/live.js") {
      response.writeHead(200, {
        ...COMMON_HEADERS,
        "Content-Type": "text/javascript; charset=utf-8",
      });
      response.end(head ? undefined : LIVE_RELOAD_SCRIPT);
      return;
    }
    if (path === "__webforge/events") {
      openStream(listener, request, response);
      return;
    }
    const wanted = path === "" || path.endsWith("/") ? `${path}index.html` : path;
    if (built) {
      serveFile(wanted, listener, request, response, head);
      return;
    }
    // Before the first build: wait for it, then answer; a browser opened at once gets its page.
    for (const watcher of watchers) watcher();
    const answer = (ready: boolean) => {
      clearTimeout(timer);
      waiting.delete(answer);
      if (ready) serveFile(wanted, listener, request, response, head);
      else notReady(response);
    };
    const timer = setTimeout(() => answer(false), FIRST_BUILD_WAIT_MS);
    waiting.add(answer);
    request.on("close", () => {
      clearTimeout(timer);
      waiting.delete(answer);
    });
  };

  return {
    base,
    phoneBase: () => servers.get("network")?.base,
    onPhoneStopped(listener) {
      phoneStopped.add(listener);
    },
    async listen(scope, host) {
      // This computer only, unless a phone is to open it: then the one local address chosen,
      // never a VPN's or another adapter's.
      const address = scope === "local" ? "127.0.0.1" : host;
      if (address === undefined) throw new Error("A network preview needs its address");
      const running = servers.get(scope);
      if (running !== undefined && running.host === address) return running.port;
      if (running !== undefined) {
        servers.delete(scope);
        await closeServer(running);
      }
      const server = createServer((request, response) =>
        handle(scope, listener, request, response),
      );
      const port = new Promise<number>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, address, () => {
          server.off("error", reject);
          resolve((server.address() as AddressInfo).port);
        });
      });
      // This computer's base stays; the phone's is new each time its listener starts (S9).
      const listener: Listener = {
        server,
        port,
        host: address,
        base: scope === "local" ? base : newBase(),
      };
      servers.set(scope, listener);
      if (scope === "network") stillUsed(listener);
      port.catch(() => {
        if (servers.get(scope) === listener) servers.delete(scope);
      });
      return port;
    },
    async stop(scope) {
      const running = servers.get(scope);
      if (running === undefined) return;
      servers.delete(scope);
      await closeServer(running);
    },
    update(build) {
      const stylesheet = files.get(PREVIEW_STYLESHEET);
      if (build.full) files = new Map();
      for (const { path, data } of build.changed) {
        files.set(path, data);
        versions.set(path, ++version);
      }
      for (const path of build.removed) files.delete(path);
      const changed = [...build.changed.map((file) => file.path), ...build.removed];
      if (!built) {
        built = true;
        for (const answer of [...waiting]) answer(true);
        return;
      }
      if (changed.length === 0) return;
      if (changed.every((path) => path === PREVIEW_STYLESHEET)) {
        // The theme's values alone (a colour, a size): sent as they are, nothing to download.
        const next = files.get(PREVIEW_STYLESHEET);
        const values =
          stylesheet === undefined || next === undefined
            ? undefined
            : changedValues(decoder.decode(stylesheet), decoder.decode(next));
        if (values !== undefined) send("values", { css: values });
        else send("css", { href: PREVIEW_STYLESHEET });
        return;
      }
      // Pages that changed reload; anything else (an image, the script) reloads every page.
      const pages = changed.filter((path) => path.endsWith(".html"));
      const assets = changed.some((path) => !path.endsWith(".html") && path !== PREVIEW_STYLESHEET);
      send("reload", { pages, all: build.full || assets });
    },
    show(page) {
      send("show", { page });
    },
    failed() {
      for (const answer of [...waiting]) answer(false);
    },
    watching: () => streams.size,
    onWatch(listener) {
      watchers.add(listener);
    },
    async close() {
      for (const answer of [...waiting]) answer(false);
      for (const stream of streams.keys()) stream.end();
      streams.clear();
      const stopping = [...servers.values()];
      servers.clear();
      await Promise.all(stopping.map(closeServer));
    },
  };
}
