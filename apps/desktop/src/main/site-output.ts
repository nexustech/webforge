import { networkInterfaces } from "node:os";
import type { SiteSnapshot } from "@webforge/model";
import type { WebContents } from "electron";
import { previewEvents } from "../shared/ipc/preview.js";
import { publishEvents } from "../shared/ipc/publish.js";
import { siteEvents } from "../shared/ipc/site.js";
import type { AppElectron } from "./app-parts.js";
import { type CodeTrust, withTrustedCode } from "./code-trust.js";
import type { NativeDialogs } from "./dialogs.js";
import { netlifyApiFor } from "./e2e-netlify.js";
import { createExportFeature } from "./export-feature.js";
import { createNetlifySignIns } from "./netlify-auth.js";
import { netlifyFeature } from "./netlify-ipc.js";
import { hasAddress, phoneAddressFor } from "./network-address.js";
import { createPageCapture, electronCaptureWindows } from "./page-capture.js";
import { createPreviewBuilder } from "./preview-builder.js";
import { createPreview, previewFeature, writePageFile } from "./preview-ipc.js";
import { createPreviewServer } from "./preview-server.js";
import type { ProjectSession } from "./project-session.js";
import { publishDestinationsFeature } from "./publish-destinations-ipc.js";
import { createKeyFiles, publishCallsFeature, testSignIn } from "./publish-ipc.js";
import { publishRunFeature } from "./publish-run.js";
import { createPublishSecrets } from "./publish-secrets.js";
import type { SiteFonts } from "./site-fonts.js";
import type { WorkerProcess } from "./worker-process.js";

/** What the site's output works with: its preview, its export and its publishing (#985). */
export type SiteOutputDeps = {
  readonly session: ProjectSession;
  readonly codeTrust: Pick<CodeTrust, "trusted">;
  readonly fonts: Pick<SiteFonts, "fontsOf" | "previewFontsOf">;
  readonly dialogs: Pick<NativeDialogs, "export" | "publish" | "preview">;
  /** The keychain's store, for publish destinations' sign-ins only (#666, S2, S38). */
  readonly credentials: Parameters<typeof createPublishSecrets>[0];
  /** A worker of the export's script, whose crash becomes a local report (R3). */
  readonly forkWorker: (serviceName: string) => WorkerProcess;
  /**
   * Electron's `shell`, whose methods are looked up as they're called (the E2E tests replace them),
   * and its windows and sessions, which draw a page as a picture or a PDF (5.22).
   */
  readonly electron: Pick<AppElectron, "shell" | "BrowserWindow" | "session">;
  readonly packaged: boolean;
  /** The editor's window, told of a preview's phone and of exports' and publishes' progress. */
  readonly mainWindow: () => { readonly webContents: Pick<WebContents, "send"> } | undefined;
  /** How many of Webforge's own versions each site keeps: the person's choice (P3). */
  readonly versionsKept: () => number;
  /** The renderer saves its last changes (`app:flush`). */
  readonly flush: () => Promise<void>;
};

/**
 * The site's output (#985): its preview, its export, and publishing it, each a feature of the app.
 * Every build gets only the code the open site's owner trusts (#649).
 */
export function siteOutput(deps: SiteOutputDeps) {
  const { session, fonts, mainWindow } = deps;
  const trustedOnly = (snapshot: SiteSnapshot) =>
    withTrustedCode(snapshot, session.projectId(), deps.codeTrust);
  // Its builds in a worker of their own while a preview is open, so an export never waits behind
  // one; opened in the default browser, which the site's scripts run in, never in an Electron window.
  const preview = createPreview({
    startServer: createPreviewServer,
    // A preview's builds read the Media of the opening it was started for (#663).
    startBuilder: (onBuilt, readMedia) =>
      createPreviewBuilder(() => deps.forkWorker("Webforge preview"), { readMedia, onBuilt }),
    site: (sessionId) => session.forSession(sessionId),
    jobFor: async (sent) => {
      const snapshot = await trustedOnly(sent);
      return { type: "preview", snapshot, ...(await fonts.previewFontsOf(snapshot.theme)) };
    },
    // Only the preview's own address, which this process makes: never one from the renderer.
    openInBrowser: async (url) => {
      try {
        await deps.electron.shell.openExternal(url);
        return true;
      } catch {
        return false;
      }
    },
    networkAddress: phoneAddressFor(deps.packaged),
    hasAddress: (address) => hasAddress(networkInterfaces(), address),
    phoneStopped: () => mainWindow()?.webContents.send(previewEvents.phoneStopped.channel),
  });
  // The export, whose runner Publish shares (ADR 0018 §1).
  const exportFeature = createExportFeature({
    dialogs: deps.dialogs.export,
    startWorker: () => deps.forkWorker("Webforge export"),
    fontsOf: fonts.fontsOf,
    snapshotFor: trustedOnly,
    sendProgress: (operationId, progress) =>
      mainWindow()?.webContents.send(siteEvents.exportProgress.channel, operationId, progress),
    // The site each export call is for (#663): its Media and its export choices.
    site: (sessionId) => session.forSession(sessionId),
    shell: deps.electron.shell,
  });
  // Publish passwords, keys and tokens (#666, 4.4a), in the keychain: never in a site file.
  const secrets = createPublishSecrets(deps.credentials);
  // The key files the person chose (4.3), by handle: Test connection and saving read them.
  const keys = createKeyFiles();
  return {
    export: exportFeature,
    // A page saved as a picture or a PDF (5.22), drawn from a build of its own.
    preview: previewFeature(preview, {
      chooseFile: deps.dialogs.preview.choosePageFileToSave,
      capture: createPageCapture(electronCaptureWindows(deps.electron)),
      write: writePageFile,
    }),
    // The open site's publish destinations (4.4a): the list in its file, sign-ins in the keychain.
    destinations: publishDestinationsFeature({
      site: (sessionId) => session.site(sessionId),
      secrets,
      keys,
      test: testSignIn,
    }),
    // Publish (4.5): read, gated, built and sent in the export worker, then saved as a version.
    publish: publishRunFeature({
      site: (sessionId) => ({
        ...session.forSession(sessionId),
        withStore: session.site(sessionId).withStore,
      }),
      secrets,
      trusted: (projectId) => deps.codeTrust.trusted(projectId),
      fontsOf: fonts.fontsOf,
      runner: exportFeature.runner,
      sendProgress: (operationId, progress) =>
        mainWindow()?.webContents.send(publishEvents.progress.channel, operationId, progress),
      versionsKept: deps.versionsKept,
      flush: deps.flush,
      // So Clean up keeps what a publish under way reaches (4.6).
      holdManifest: (manifest) => session.holdManifest(manifest),
      openExternal: (url) => deps.electron.shell.openExternal(url),
      // Netlify's own API, or the E2E tests' mock in an unpackaged app (#70).
      netlifyApi: netlifyApiFor(deps.packaged),
    }),
    // File-transfer destinations' tests and key files (4.3).
    publishCalls: publishCallsFeature(deps.dialogs.publish, keys),
    // Netlify sign-in for publish destinations (4.2): the OAuth client ID is a build setting,
    // empty until Webforge's Netlify app is registered, when only a pasted token works.
    netlify: netlifyFeature({
      signIns: createNetlifySignIns({
        clientId: import.meta.env.MAIN_VITE_NETLIFY_CLIENT_ID,
        // The E2E tests' stand-in for Netlify, in an app run from its build folder only.
        apiBase: netlifyApiFor(deps.packaged),
        openExternal: (url) => deps.electron.shell.openExternal(url),
      }),
      site: (sessionId) => session.site(sessionId),
      secrets,
    }),
  };
}
