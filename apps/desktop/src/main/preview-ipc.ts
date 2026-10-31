import type { SiteSnapshot } from "@webforge/model";
import type { IpcMain } from "electron";
import type { PreviewJob, PreviewOutcome } from "../shared/export-worker-protocol.js";
import type { PhoneAddress, PreviewPage } from "../shared/ipc/preview.js";
import type { SiteContent } from "../shared/ipc/site.js";
import { snapshotOf } from "./export-ipc.js";
import { registerIpcHandler } from "./ipc.js";
import { log } from "./log.js";
import type { PreviewBuilder } from "./preview-builder.js";
import type { PreviewScope, PreviewServer } from "./preview-server.js";
import type { SessionSite } from "./project-session.js";

/** The open site as a preview of one opening of it reaches it (R6, #663): its Media. */
export type PreviewSite = Pick<SessionSite, "staleReason" | "readMedia">;

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
};

/**
 * The open site's preview (3.2): started by the first open, stopped when the site closes. Each
 * call that sends the site names the opening it is for (`sessionId`, #663).
 */
export type Preview = {
  open(sessionId: string, site: SiteContent, page: PreviewPage): Promise<"opened" | "failed">;
  update(sessionId: string, site: SiteContent): Promise<void>;
  show(page: PreviewPage): void;
  phone(sessionId: string, site: SiteContent, page: PreviewPage): Promise<PhoneAddress>;
  /** Stops the phone's listener only (Stop Phone Preview); the desktop preview goes on. */
  stopPhone(): Promise<void>;
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
  // Each site taken in turn: one whose fonts take longer to read never replaces a later one.
  let taken = 0;

  const build = () => {
    if (running === undefined || latest === undefined || !stale) return;
    stale = false;
    running.builder.request(latest);
  };

  const stop = async () => {
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

  const listen = async (sessionId: string, scope: PreviewScope, host?: string) => {
    const { server } = await start(sessionId);
    const port = await server.listen(scope, host);
    build();
    return { port, base: server.base };
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
      if (running?.sessionId !== sessionId) await stop();
      await take(site);
      const { port, base } = await listen(sessionId, "network", host);
      return { status: "ready", url: pageUrl(host, port, base, page) };
    },
    async stopPhone() {
      await running?.server.stop("network");
    },
    close: stop,
  };
}

/** Registers the `preview` IPC calls (3.2) on the open site's preview. */
export function registerPreviewHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  preview: Preview,
): void {
  registerIpcHandler(ipc, "previewOpen", isTrustedSender, (sessionId, site, page) =>
    preview.open(sessionId, site, page),
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
    preview.phone(sessionId, site, page),
  );
  registerIpcHandler(ipc, "previewStopPhone", isTrustedSender, async () => {
    await preview.stopPhone();
    return null;
  });
}
