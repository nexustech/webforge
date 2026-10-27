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

/** What the preview reaches outside this module; injected, so tests need no Electron or network. */
export type PreviewDeps = {
  /** A new preview server, not yet listening. */
  readonly startServer: () => PreviewServer;
  /** A new preview builder, telling `onBuilt` each build's outcome. */
  readonly startBuilder: (onBuilt: (outcome: PreviewOutcome) => void) => PreviewBuilder;
  /** The build job for `snapshot`: its fonts read and checked here, as an export's (2.2). */
  readonly jobFor: (snapshot: SiteSnapshot) => Promise<PreviewJob>;
  /** Opens `url`, the preview's own address, in the default browser; whether it could. */
  readonly openInBrowser: (url: string) => Promise<boolean>;
  /** This computer's address on its local network, for a phone; none when it isn't on one. */
  readonly networkAddress: () => string | undefined;
};

/** The open site's preview (3.2): started by the first open, stopped when the site closes. */
export type Preview = {
  open(site: SiteContent, page: PreviewPage): Promise<"opened" | "failed">;
  update(site: SiteContent): Promise<void>;
  show(page: PreviewPage): void;
  phone(site: SiteContent, page: PreviewPage): Promise<PhoneAddress>;
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
 */
export function createPreview(deps: PreviewDeps): Preview {
  let running: { server: PreviewServer; builder: PreviewBuilder } | undefined;
  let latest: PreviewJob | undefined;
  let stale = false;
  // Each site taken in turn: one whose fonts take longer to read never replaces a later one.
  let taken = 0;

  const build = () => {
    if (running === undefined || latest === undefined || !stale) return;
    stale = false;
    running.builder.request(latest);
  };

  const start = () => {
    if (running !== undefined) return running;
    const server = deps.startServer();
    const builder = deps.startBuilder((outcome) => {
      if (outcome.type === "previewed") {
        server.update(outcome);
        return;
      }
      log.error("Webforge could not build the preview", { detail: outcome.detail });
      server.failed();
    });
    // A browser that starts watching gets the latest edits built.
    server.onWatch(build);
    running = { server, builder };
    return running;
  };

  const take = async (site: SiteContent) => {
    const turn = ++taken;
    const job = await deps.jobFor(snapshotOf(site));
    if (turn !== taken) return;
    latest = job;
    stale = true;
  };

  const listen = async (scope: PreviewScope, host?: string) => {
    const { server } = start();
    const port = await server.listen(scope, host);
    build();
    return { port, base: server.base };
  };

  return {
    async open(site, page) {
      try {
        await take(site);
        const { port, base } = await listen("local");
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
    async update(site) {
      if (running === undefined) return;
      await take(site);
      if (running.server.watching() > 0) build();
    },
    show(page) {
      running?.server.show(page);
    },
    async phone(site, page) {
      const host = deps.networkAddress();
      if (host === undefined) return { status: "offline" };
      await take(site);
      const { port, base } = await listen("network", host);
      return { status: "ready", url: pageUrl(host, port, base, page) };
    },
    async stopPhone() {
      await running?.server.stop("network");
    },
    async close() {
      const stopping = running;
      running = undefined;
      latest = undefined;
      stale = false;
      if (stopping === undefined) return;
      stopping.builder.close();
      await stopping.server.close();
    },
  };
}

/** Registers the `preview` IPC calls (3.2) on the open site's preview. */
export function registerPreviewHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  preview: Preview,
): void {
  registerIpcHandler(ipc, "previewOpen", isTrustedSender, (site, page) => preview.open(site, page));
  registerIpcHandler(ipc, "previewUpdate", isTrustedSender, async (site) => {
    await preview.update(site);
    return null;
  });
  registerIpcHandler(ipc, "previewShow", isTrustedSender, (page) => {
    preview.show(page);
    return null;
  });
  registerIpcHandler(ipc, "previewPhone", isTrustedSender, (site, page) =>
    preview.phone(site, page),
  );
  registerIpcHandler(ipc, "previewStopPhone", isTrustedSender, async () => {
    await preview.stopPhone();
    return null;
  });
}
