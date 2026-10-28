import type { IpcMain } from "electron";
import type { BundleResult } from "../shared/ipc/site.js";
import { type BundleNetwork, downloadForBundle } from "./bundle-download.js";
import { registerIpcHandler } from "./ipc.js";
import { log } from "./log.js";
import type { ProjectSession } from "./project-session.js";

/** `url`'s host, the one part of a download the log may name; nothing when it has none. */
function hostOf(url: string): string | undefined {
  try {
    return new URL(url.startsWith("//") ? `https:${url}` : url).host;
  } catch {
    return undefined;
  }
}

/**
 * Registers Download and bundle (C8, 3.9): on the person's click in Site Check, the file at an
 * address the site's code names is downloaded ({@link downloadForBundle}) and stored in the site
 * the renderer was loaded for (R6). The renderer keeps the files in the site's code as one undo
 * step; until then, and after an Undo, garbage collection removes their bytes again. The log names
 * a failed download's host and reason, never its address.
 */
export function registerBundleHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  session: Pick<ProjectSession, "staleReason" | "forSession">,
  network: BundleNetwork,
): void {
  registerIpcHandler(
    ipc,
    "bundleFile",
    isTrustedSender,
    async (sessionId, url): Promise<BundleResult> => {
      const stale = session.staleReason(sessionId);
      if (stale !== undefined) return { status: "failed", reason: stale };
      const downloaded = await downloadForBundle(network, url);
      if (downloaded.status === "failed") {
        log.warn("Webforge could not download a file to keep with the site", {
          host: hostOf(url),
          reason: downloaded.reason,
        });
        return downloaded;
      }
      const stored = await session.forSession(sessionId).storeBlobs(downloaded.files);
      if (stored.status === "failed") return stored;
      return {
        status: "bundled",
        files: downloaded.files.map((file, index) => ({
          url: file.url,
          file: file.file,
          hash: stored.hashes[index] ?? "",
          mime: file.mime,
        })),
      };
    },
  );
}
