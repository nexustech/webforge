import {
  BuildError,
  buildSite,
  type ImageCache,
  type PipelineResources,
  type StoredMedia,
  WriteError,
  writeSiteFolder,
} from "@webforge/pipeline";
import { siteLibrary } from "@webforge/site-components";
import { FONT_CATALOGUE } from "@webforge/themes";
import type { ExportJob, ExportOutcome } from "../shared/export-worker-protocol.js";

/** What an export reaches outside the worker: the site's stored bytes, a cancel, a cache. */
export type ExportChannel = {
  /** The bytes the open site stores under a hash, asked of the main process one at a time (R15). */
  readonly readMedia: (hash: string) => Promise<StoredMedia | undefined>;
  /** Aborted when the main process cancels the export. */
  readonly signal: AbortSignal;
  /** Encoded images of earlier exports, so an unchanged image isn't encoded again. */
  readonly imageCache?: ImageCache | undefined;
};

/** Builds the site of `job` and writes it to its destination; never throws. */
export async function runExport(
  job: ExportJob,
  loadResources: () => Promise<PipelineResources>,
  channel: ExportChannel,
): Promise<ExportOutcome> {
  const started = performance.now();
  try {
    // The site's fonts come with the job, the downloaded families it uses too: the main process
    // read and checked them (2.2).
    const fonts = new Map(job.fonts.map((font) => [font.file, font.data]));
    const resources = {
      ...(await loadResources()),
      readFont: async (face: { readonly file: string }) => fonts.get(face.file),
      fonts: [...FONT_CATALOGUE, ...job.families],
      readMedia: channel.readMedia,
      ...(channel.imageCache === undefined ? {} : { imageCache: channel.imageCache }),
    };
    const built = await buildSite(job.snapshot, siteLibrary, resources, { signal: channel.signal });
    await writeSiteFolder(built.files, job.destination, channel.signal);
    return {
      type: "exported",
      pages: built.report.pages,
      files: built.report.files,
      bytes: built.report.bytes,
      warnings: built.report.warnings.length,
      durationMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    if (
      (error instanceof BuildError || error instanceof WriteError) &&
      error.code === "cancelled"
    ) {
      return { type: "cancelled" };
    }
    if (error instanceof BuildError && error.code === "reserved-name") {
      return {
        type: "failed",
        code: "reserved-name",
        detail: error.code,
        ...(error.page === undefined ? {} : { page: error.page }),
      };
    }
    if (error instanceof BuildError) {
      return { type: "failed", code: "build-failed", detail: error.code };
    }
    if (error instanceof WriteError && error.code !== "cancelled") {
      return { type: "failed", code: error.code, detail: error.code };
    }
    return { type: "failed", code: "build-failed", detail: "unexpected" };
  }
}
