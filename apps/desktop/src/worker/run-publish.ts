import { createHash } from "node:crypto";
import {
  BuildError,
  type Pipeline,
  type PipelineResources,
  type StoredMedia,
} from "@webforge/pipeline";
import { PublishError, type PublishedEvent, publisherFor } from "@webforge/publish";
import { type ComponentLibrary, siteSnapshotFor } from "@webforge/site-components";
import { FONT_CATALOGUE } from "@webforge/themes";
import type { PublishJob, PublishOutcome } from "../shared/export-worker-protocol.js";
import type { PublishProgress } from "../shared/ipc/publish.js";

/** What a publish reaches outside the worker: the site's stored bytes, a cancel, its pipeline. */
export type PublishChannel = {
  /** The bytes the site stores under a hash, asked of the main process one at a time (R15). */
  readonly readMedia: (hash: string) => Promise<StoredMedia | undefined>;
  /** Aborted when the main process cancels the publish. */
  readonly signal: AbortSignal;
  /** The worker's pipeline, which keeps what earlier builds made that this one can use (3.1). */
  readonly pipeline: Pipeline;
  /** The components the site is made of: where its images and links are. */
  readonly library: ComponentLibrary;
  /** Told as the publish reaches each stage. */
  readonly onProgress?: ((progress: PublishProgress) => void) | undefined;
  /** The publisher for the job's destination; `publisherFor`'s, unless a test gives its own. */
  readonly publisherFor?: typeof publisherFor | undefined;
};

/** A piece of code as the code trust record keeps it (#649). */
const hashOf = (text: string) => createHash("sha256").update(text).digest("hex");

/**
 * Publishes `job` (4.5, ADR 0018 §1): makes its site's snapshot (§3), builds it for publishing,
 * the code its owner doesn't trust left blank (#649), then sends what changed to the destination
 * and checks the live site (`publishSite`). Never throws, and never puts the sign-in in what it
 * answers or logs.
 */
export async function runPublish(
  job: PublishJob,
  loadResources: () => Promise<PipelineResources>,
  channel: PublishChannel,
): Promise<PublishOutcome> {
  const started = performance.now();
  const progress = (stage: PublishProgress) => channel.onProgress?.(stage);
  try {
    // The site's fonts come with the job, the downloaded families it uses too (2.2).
    const fonts = new Map(job.fonts.map((font) => [font.file, font.data]));
    const resources = {
      ...(await loadResources()),
      readFont: async (face: { readonly file: string }) => fonts.get(face.file),
      fonts: [...FONT_CATALOGUE, ...job.families],
      readMedia: channel.readMedia,
    };
    const trusted = new Set(job.trustedCode);
    let files: ReadonlyMap<string, Uint8Array> | undefined;
    const build = channel.pipeline.build(siteSnapshotFor(job.site, channel.library), resources, {
      mode: "publish",
      signal: channel.signal,
      runsCode: (code) => trusted.has(hashOf(code)),
    });
    for await (const event of build) {
      if (event.stage === "done") files = event.site.files;
      else progress(event);
    }
    if (files === undefined) return { type: "failed", code: "build-failed", detail: "unexpected" };

    const publisher = (channel.publisherFor ?? publisherFor)(
      job.destination,
      job.signIn,
      job.trust,
    );
    let published: PublishedEvent | undefined;
    let check: Extract<PublishOutcome, { type: "published" }>["check"] = "unchecked";
    const target = {
      site: job.target.site,
      ...(job.target.replaceOtherSite === true ? { replaceOtherSite: true } : {}),
    };
    for await (const event of publisher.publish({ files }, target, channel.signal)) {
      if (event.type === "preparing") progress({ stage: "preparing" });
      else if (event.type === "uploading") {
        progress({ stage: "uploading", done: event.done, total: event.total });
      } else if (event.type === "published") published = event;
      else if (event.type === "verifying") progress({ stage: "verifying" });
      else check = event.result.status;
    }
    if (published === undefined) {
      return { type: "failed", code: "failed", detail: "unexpected" };
    }
    return {
      type: "published",
      url: published.url,
      uploaded: published.uploaded,
      unchanged: published.unchanged,
      removed: published.removed,
      ...(published.version === undefined ? {} : { version: published.version }),
      check,
      durationMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    return failureOf(error);
  }
}

/** What became of a publish that threw: by its code only, never with a secret or a path. */
function failureOf(error: unknown): PublishOutcome {
  if (error instanceof PublishError) {
    const { code } = error;
    return code === "cancelled" ? { type: "cancelled" } : { type: "failed", code, detail: code };
  }
  if (error instanceof BuildError && error.code === "cancelled") return { type: "cancelled" };
  if (error instanceof BuildError && error.code === "reserved-name") {
    return {
      type: "failed",
      code: "reserved-name",
      detail: error.code,
      ...(error.page === undefined ? {} : { page: error.page }),
    };
  }
  if (error instanceof BuildError && error.code === "unreadable-image") {
    return {
      type: "failed",
      code: "unreadable-image",
      detail: error.code,
      ...(error.image === undefined ? {} : { image: error.image }),
    };
  }
  if (error instanceof BuildError)
    return { type: "failed", code: "build-failed", detail: error.code };
  return { type: "failed", code: "failed", detail: "unexpected" };
}
