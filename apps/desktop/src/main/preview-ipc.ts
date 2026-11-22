import { writeFile } from "node:fs/promises";
import { basename } from "node:path";
import type { SiteSnapshot } from "@webforge/model";
import type { IpcMain } from "electron";
import type { PreviewJob, PreviewOutcome } from "../shared/export-worker-protocol.js";
import type { PhoneAddress, PreviewPage, SavePageResult } from "../shared/ipc/preview.js";
import type { SiteContent } from "../shared/ipc/site.js";
import type { AppFeature } from "./app-feature.js";
import { snapshotOf } from "./export-ipc.js";
import { registerIpcHandler } from "./ipc.js";
import { log } from "./log.js";
import type { CaptureKind, PageCapture } from "./page-capture.js";
import type { PreviewBuilder } from "./preview-builder.js";
import {
  CAPTURE_PATH,
  type PreviewScope,
  type PreviewServer,
  VERSION_PATH,
} from "./preview-server.js";
import type { SessionSite } from "./project-session.js";
import { recordUsage } from "./usage.js";

/** The open site as a preview of one opening of it reaches it (R6, #663): its Media. */
type PreviewSite = Pick<SessionSite, "staleReason" | "readMedia">;

/** What the preview reaches outside this module; injected, so tests need no Electron or network. */
export type PreviewDeps = {
  /** A new preview server, not yet listening. */
  readonly startServer: () => PreviewServer;
  /**
   * A new preview builder, reading the site's Media with `readMedia` and telling `onBuilt` each
   * build's outcome.
   */
  readonly startBuilder: (
    onBuilt: (outcome: PreviewOutcome) => void,
    readMedia: PreviewSite["readMedia"],
  ) => PreviewBuilder;
  /** The open site for a call from a renderer loaded for opening `sessionId` (R6). */
  readonly site: (sessionId: string) => PreviewSite;
  /** The build job for `snapshot`: its fonts read and checked here, as an export's (2.2). */
  readonly jobFor: (snapshot: SiteSnapshot) => Promise<PreviewJob>;
  /** Opens `url`, the preview's own address, in the default browser; whether it could. */
  readonly openInBrowser: (url: string) => Promise<boolean>;
  /** This computer's address on its local network, for a phone; none when it isn't on one. */
  readonly networkAddress: () => string | undefined;
  /** Whether `address` is still one of this computer's: the phone's listener stops once it isn't. */
  readonly hasAddress: (address: string) => boolean;
  /** Tells the window the phone's listener stopped by itself: unused, or its network gone (S9). */
  readonly phoneStopped: () => void;
  /** How long a page has to be built and drawn (5.22); {@link RENDER_MS} unless a test says. */
  readonly renderMs?: number | undefined;
};

/** How long a page has to be built and drawn as a picture or a PDF, all told (5.22). */
const RENDER_MS = 180_000;

/** How often the phone's address is checked for, while a phone can open the preview. */
const ADDRESS_CHECK_MS = 5_000;

/**
 * The open site's preview (3.2): started by the first open, stopped when the site closes. Each
 * call that sends the site names the opening it is for (`sessionId`, #663).
 */
export type Preview = {
  open(sessionId: string, site: SiteContent, page: PreviewPage): Promise<"opened" | "failed">;
  /**
   * Opens a version's site (Version History's Preview, 4.6) at `page` in the default browser, as
   * it was: built once, by a builder of its own so the editor's builds never drop it, and served
   * apart from the live preview, which never changes it.
   */
  openVersion(
    sessionId: string,
    site: SiteContent,
    page: PreviewPage,
  ): Promise<"opened" | "failed">;
  update(sessionId: string, site: SiteContent): Promise<void>;
  show(page: PreviewPage): void;
  phone(sessionId: string, site: SiteContent, page: PreviewPage): Promise<PhoneAddress>;
  /** Stops the phone's listener only (Stop Phone Preview); the desktop preview goes on. */
  stopPhone(): Promise<void>;
  /**
   * Draws `page` of `site` as it is now with `draw`, given the page's address (5.22): built once,
   * by a builder of its own, as a version is, and served apart from the live preview while it's
   * drawn. `undefined` when it couldn't be built or served; one drawing at a time.
   */
  render<T>(
    sessionId: string,
    site: SiteContent,
    page: PreviewPage,
    draw: (url: string) => Promise<T>,
  ): Promise<T | undefined>;
  /** Stops the server and the builder: the site closed, or the app quits. */
  close(): Promise<void>;
};

/** `page`'s address under the server's base, each part of its path encoded. */
const pageUrl = (host: string, port: number, base: string, page: PreviewPage) =>
  `http://${host}:${port}${base}${page.split("/").map(encodeURIComponent).join("/")}`;

/**
 * The open site's preview (3.2, F-PV-1). The first `open` or `phone` starts a server and a build
 * worker; each later change of the site replaces the job to build. It is built only while a browser
 * shows the preview (or waits for its first page): the latest site then, once, whatever edits came
 * before, so an editor nobody previews spends nothing on builds. The server listens on this
 * computer only until a phone is asked for. Failures are logged by code, never with site content.
 *
 * A preview is of one opening of the site (#663): its builds read that opening's Media only. A call
 * for an opening a hand-off has replaced changes nothing: the window reloads with the new site.
 */
export function createPreview(deps: PreviewDeps): Preview {
  let running:
    | { server: PreviewServer; builder: PreviewBuilder; readonly sessionId: string }
    | undefined;
  let latest: PreviewJob | undefined;
  let stale = false;
  // While a phone can open the preview: the check that its address is still this computer's.
  let watchingAddress: ReturnType<typeof setInterval> | undefined;
  const stopWatchingAddress = () => {
    clearInterval(watchingAddress);
    watchingAddress = undefined;
  };
  // Each site taken in turn: one whose fonts take longer to read never replaces a later one.
  let taken = 0;

  const build = () => {
    if (running === undefined || latest === undefined || !stale) return;
    stale = false;
    running.builder.request(latest);
  };

  const stop = async () => {
    stopWatchingAddress();
    const stopping = running;
    running = undefined;
    latest = undefined;
    stale = false;
    if (stopping === undefined) return;
    stopping.builder.close();
    await stopping.server.close();
  };

  /** The preview of opening `sessionId`: the running one, or a new one in place of another's. */
  const start = async (sessionId: string) => {
    if (running?.sessionId === sessionId) return running;
    // Another opening's: `open` and `phone` stop it before they take the site, which this keeps.
    if (running !== undefined) await stop();
    const site = deps.site(sessionId);
    const server = deps.startServer();
    const builder = deps.startBuilder(
      (outcome) => {
        if (outcome.type === "previewed") {
          server.update(outcome);
          return;
        }
        log.error("Webforge could not build the preview", { detail: outcome.detail });
        server.failed();
      },
      (hash) => site.readMedia(hash),
    );
    // A browser that starts watching gets the latest edits built.
    server.onWatch(build);
    server.onPhoneStopped(() => {
      stopWatchingAddress();
      deps.phoneStopped();
    });
    running = { server, builder, sessionId };
    return running;
  };

  /** Whether opening `sessionId` is still the open site's: else the call changes nothing. */
  const current = (sessionId: string) => deps.site(sessionId).staleReason() === undefined;

  const take = async (site: SiteContent) => {
    const turn = ++taken;
    const job = await deps.jobFor(snapshotOf(site));
    if (turn !== taken) return;
    latest = job;
    stale = true;
  };

  /**
   * `site` built once, by a builder of its own so the editor's builds never drop it; none once
   * `stopped`, whose builder then closes.
   */
  const buildOnce = async (sessionId: string, site: SiteContent, stopped?: AbortSignal) => {
    const job = await deps.jobFor(snapshotOf(site));
    const media = deps.site(sessionId);
    return new Promise<PreviewOutcome | undefined>((resolve) => {
      const builder = deps.startBuilder(
        (outcome) => {
          builder.close();
          resolve(outcome);
        },
        (hash) => media.readMedia(hash),
      );
      stopped?.addEventListener(
        "abort",
        () => {
          builder.close();
          resolve(undefined);
        },
        { once: true },
      );
      builder.request(job);
    });
  };

  /** Builds `site` once and draws `page` of it with `draw` (5.22): see {@link Preview.render}. */
  async function drawOnce<T>(
    sessionId: string,
    site: SiteContent,
    page: PreviewPage,
    draw: (url: string) => Promise<T>,
    stopped: AbortSignal,
  ): Promise<T | undefined> {
    if (!current(sessionId)) return undefined;
    try {
      if (running?.sessionId !== sessionId) await stop();
      const { server } = await start(sessionId);
      const built = await buildOnce(sessionId, site, stopped);
      if (built?.type !== "previewed") {
        if (built !== undefined) {
          log.error("Webforge could not build a page to draw", { detail: built.detail });
        }
        return undefined;
      }
      // The site closed, or another opened, while it built: its server has stopped.
      if (running?.server !== server || stopped.aborted) return undefined;
      server.showCapture(built);
      try {
        const port = await server.listen("local");
        return await draw(pageUrl("127.0.0.1", port, `${server.base}${CAPTURE_PATH}`, page));
      } finally {
        server.showCapture(undefined);
      }
    } catch (error) {
      log.error("Webforge could not draw a page", {
        code: error instanceof Error && "code" in error ? String(error.code) : "unknown",
      });
      return undefined;
    }
  }

  // One drawing at a time: each takes the server's capture files while it's drawn.
  let drawing: Promise<unknown> = Promise.resolve();

  const listen = async (sessionId: string, scope: PreviewScope, host?: string) => {
    const { server } = await start(sessionId);
    const port = await server.listen(scope, host);
    build();
    return { port, base: (scope === "network" ? server.phoneBase() : undefined) ?? server.base };
  };

  return {
    async open(sessionId, site, page) {
      if (!current(sessionId)) return "failed";
      try {
        if (running?.sessionId !== sessionId) await stop();
        await take(site);
        const { port, base } = await listen(sessionId, "local");
        return (await deps.openInBrowser(pageUrl("127.0.0.1", port, base, page)))
          ? "opened"
          : "failed";
      } catch (error) {
        log.error("Webforge could not start the preview", {
          code: error instanceof Error && "code" in error ? String(error.code) : "unknown",
        });
        return "failed";
      }
    },
    async openVersion(sessionId, site, page) {
      if (!current(sessionId)) return "failed";
      try {
        if (running?.sessionId !== sessionId) await stop();
        const { server } = await start(sessionId);
        const built = await buildOnce(sessionId, site);
        if (built?.type !== "previewed") {
          log.error("Webforge could not build a version's preview", {
            detail: built?.detail ?? "stopped",
          });
          return "failed";
        }
        // The site closed, or another opened, while it built: its server has stopped.
        if (running?.server !== server) return "failed";
        server.showVersion(built);
        const port = await server.listen("local");
        const url = pageUrl("127.0.0.1", port, `${server.base}${VERSION_PATH}`, page);
        return (await deps.openInBrowser(url)) ? "opened" : "failed";
      } catch (error) {
        log.error("Webforge could not preview a version", {
          code: error instanceof Error && "code" in error ? String(error.code) : "unknown",
        });
        return "failed";
      }
    },
    async update(sessionId, site) {
      if (running?.sessionId !== sessionId || !current(sessionId)) return;
      await take(site);
      if (running?.sessionId === sessionId && running.server.watching() > 0) build();
    },
    show(page) {
      running?.server.show(page);
    },
    async phone(sessionId, site, page) {
      const host = deps.networkAddress();
      // No address to give: no network, or the site was replaced (the window reloads with it).
      if (host === undefined || !current(sessionId)) return { status: "offline" };
      // The last address's check stops first: it mustn't stop the listener started here.
      stopWatchingAddress();
      if (running?.sessionId !== sessionId) await stop();
      await take(site);
      const { port, base } = await listen(sessionId, "network", host);
      // Once the computer leaves that network, the phone's listener stops (S9).
      stopWatchingAddress();
      const phoneServer = running?.server;
      watchingAddress = setInterval(() => {
        if (deps.hasAddress(host)) return;
        // The window is told before the listener closes, as for the idle stop.
        stopWatchingAddress();
        deps.phoneStopped();
        void phoneServer?.stop("network");
      }, ADDRESS_CHECK_MS);
      return { status: "ready", url: pageUrl(host, port, base, page) };
    },
    async stopPhone() {
      stopWatchingAddress();
      await running?.server.stop("network");
    },
    render(sessionId, site, page, draw) {
      const turn = drawing.then(() => {
        // Built and drawn within a time, all told: a build that never answers mustn't keep the
        // saves off, nor hold every later one behind it. Its builder closes when time's up.
        const stopped = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const late = new Promise<undefined>((resolve) => {
          timer = setTimeout(() => {
            log.error("Webforge took too long to draw a page");
            stopped.abort();
            resolve(undefined);
          }, deps.renderMs ?? RENDER_MS);
        });
        return Promise.race([drawOnce(sessionId, site, page, draw, stopped.signal), late]).finally(
          () => clearTimeout(timer),
        );
      });
      drawing = turn.catch(() => undefined);
      return turn;
    },
    close: stop,
  };
}

/**
 * Opens a preview with `open` and counts it in the usage summary (5.40): how long its build took,
 * with the site's pages and pictures, or that it failed.
 */
async function timedPreview<R>(
  on: "computer" | "phone",
  site: SiteContent,
  open: () => Promise<R>,
): Promise<R> {
  const began = performance.now();
  const result = await open();
  const failed =
    result === "failed" ||
    (typeof result === "object" &&
      result !== null &&
      "status" in result &&
      result.status === "failed");
  recordUsage(
    failed
      ? { kind: "previewFailed" }
      : {
          kind: "preview",
          on,
          ms: performance.now() - began,
          pages: site.snapshot.pages.length,
          // The images only: documents are `documents`.
          pictures: site.media.length,
        },
  );
  return result;
}

/** What saving a page as a picture or a PDF (5.22) reaches besides the preview. */
export type PageSaves = {
  /** Where to save page `name` as `kind`, as the person chooses; none when they cancel. */
  readonly chooseFile: (name: string, kind: CaptureKind) => Promise<string | undefined>;
  readonly capture: PageCapture;
  /** Writes `data` to `path`, replacing a file there: the dialog has asked first. */
  readonly write: (path: string, data: Uint8Array) => Promise<void>;
};

/** Why a file couldn't be written, as the person is told it. */
function writeFailure(error: unknown): "not-allowed" | "disk-full" | "write" {
  const code = error instanceof Error && "code" in error ? String(error.code) : undefined;
  return code === "EACCES" || code === "EPERM" || code === "EROFS"
    ? "not-allowed"
    : code === "ENOSPC"
      ? "disk-full"
      : "write";
}

/**
 * Saves a page as a picture or a PDF (5.22): asks where first, so a cancel draws and writes
 * nothing; then draws the site as it is now and writes the file there. Failures are logged by
 * code, never with the page or the path.
 */
export async function savePage(
  preview: Pick<Preview, "render">,
  saves: PageSaves,
  sessionId: string,
  site: SiteContent,
  page: {
    readonly page: PreviewPage;
    readonly name: string;
    readonly width: number;
    readonly kind: CaptureKind;
  },
): Promise<SavePageResult> {
  const path = await saves.chooseFile(page.name, page.kind);
  if (path === undefined) return { status: "canceled" };
  const drawn = await preview.render(sessionId, site, page.page, (url) =>
    saves.capture(url, page.width, page.kind),
  );
  if (drawn === undefined) return { status: "failed", reason: "draw" };
  try {
    await saves.write(path, drawn.data);
  } catch (error) {
    const reason = writeFailure(error);
    log.error("Webforge could not save a page", { reason });
    return { status: "failed", reason };
  }
  return { status: "saved", fileName: basename(path), cut: drawn.cut };
}

/** Writes a saved page's file. */
export const writePageFile = (path: string, data: Uint8Array) => writeFile(path, data);

/** Registers the `preview` IPC calls (3.2) on the open site's preview. */
export function registerPreviewHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  preview: Preview,
  saves: PageSaves,
): void {
  registerIpcHandler(ipc, "previewOpen", isTrustedSender, (sessionId, site, page) =>
    timedPreview("computer", site, () => preview.open(sessionId, site, page)),
  );
  registerIpcHandler(ipc, "previewVersion", isTrustedSender, (sessionId, site, page) =>
    preview.openVersion(sessionId, site, page),
  );
  registerIpcHandler(ipc, "previewUpdate", isTrustedSender, async (sessionId, site) => {
    await preview.update(sessionId, site);
    return null;
  });
  registerIpcHandler(ipc, "previewShow", isTrustedSender, (page) => {
    preview.show(page);
    return null;
  });
  registerIpcHandler(ipc, "previewPhone", isTrustedSender, (sessionId, site, page) =>
    timedPreview("phone", site, () => preview.phone(sessionId, site, page)),
  );
  registerIpcHandler(ipc, "previewStopPhone", isTrustedSender, async () => {
    await preview.stopPhone();
    return null;
  });
  registerIpcHandler(ipc, "previewSavePage", isTrustedSender, (sessionId, site, page) =>
    savePage(preview, saves, sessionId, site, page),
  );
}

/**
 * The preview as a feature (A12): its IPC calls, and its server and worker stopped when the site
 * closes, replaced by a hand-off or as Webforge quits.
 */
export function previewFeature(preview: Preview, saves: PageSaves): AppFeature {
  return {
    register: (ipc, isTrustedSender) => {
      registerPreviewHandlers(ipc, isTrustedSender, preview, saves);
    },
    site: {
      closed: () => {
        void preview.close();
      },
    },
  };
}
