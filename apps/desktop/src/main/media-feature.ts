import type { Protocol } from "electron";
import {
  type ThumbnailJob,
  type ThumbnailOutcome,
  thumbnailOutcomeSchema,
} from "../shared/export-worker-protocol.js";
import { MEDIA_SCHEME } from "../shared/ipc/media.js";
import type { AppFeature } from "./app-feature.js";
import { type MediaDialogs, registerMediaHandlers } from "./media-ipc.js";
import { createMediaResponder, type MediaResponderOptions } from "./media-protocol.js";
import type { ProjectSession } from "./project-session.js";
import type { WorkerProcess } from "./worker-process.js";
import { createWorkerRequests } from "./worker-requests.js";

/** What Media is served and imported with (1.16, #985). */
export type MediaFeatureDeps = {
  /** Starts the worker that makes thumbnails, when the first is needed. */
  readonly startWorker: () => WorkerProcess;
  /** A Media file of the open site, by hash. */
  readonly readMedia: MediaResponderOptions["readMedia"];
  /** The site's openings, which imports go into (R6). */
  readonly session: Pick<ProjectSession, "staleReason" | "forSession">;
  readonly dialogs: MediaDialogs;
  /** The editor's session's schemes, once Electron is ready. */
  readonly protocol: () => Pick<Protocol, "handle">;
};

/**
 * Media (1.16, #985): its images reach the editor through a scheme of its own, as the files the
 * open site keeps, or their WebP thumbnails, made in a long-lived worker started when the first is
 * needed; and its calls import files into the site the renderer was loaded for.
 */
export function mediaFeature(deps: MediaFeatureDeps): AppFeature {
  const requestThumbnail = createWorkerRequests<ThumbnailOutcome, ThumbnailJob>(
    deps.startWorker,
    thumbnailOutcomeSchema,
    60_000,
  );
  const respond = createMediaResponder({
    readMedia: deps.readMedia,
    makeThumbnail: async (data, mimeType) => {
      const outcome = await requestThumbnail({ type: "thumbnail", mimeType, data });
      return outcome?.type === "thumbnail" ? outcome.data : undefined;
    },
  });
  return {
    register(ipc, isTrustedSender) {
      deps.protocol().handle(MEDIA_SCHEME, (request) => respond(request.url));
      registerMediaHandlers(ipc, isTrustedSender, deps.session, deps.dialogs);
    },
  };
}
