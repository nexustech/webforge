import {
  BuildError,
  type Pipeline,
  type PipelineResources,
  type StoredMedia,
  WriteError,
  writeSiteFolder,
  writeSiteZip,
} from "@webforge/pipeline";
import { FONT_CATALOGUE } from "@webforge/themes";
import type { ExportJob, ExportOutcome } from "../shared/export-worker-protocol.js";
import { type ExportProgress, MAX_REPORTED_WARNINGS } from "../shared/ipc/site.js";

/** What an export reaches outside the worker: the site's stored bytes, a cancel, its pipeline. */
export type ExportChannel = {
  /** The bytes the open site stores under a hash, asked of the main process one at a time (R15). */
  readonly readMedia: (hash: string) => Promise<StoredMedia | undefined>;
  /** Aborted when the main process cancels the export. */
  readonly signal: AbortSignal;
  /** The open site's pipeline, which keeps what earlier exports made that this one can use (3.1). */
  readonly pipeline: Pipeline;
  /** Told as the export reaches each stage. */
  readonly onProgress?: ((progress: ExportProgress) => void) | undefined;
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
    };
    const events = channel.pipeline.build(job.snapshot, resources, {
      mode: "export",
      signal: channel.signal,
      output: job.output,
    });
    for await (const event of events) {
      if (event.stage !== "done") {
        channel.onProgress?.(event);
        continue;
      }
      const built = event.site;
      channel.onProgress?.({ stage: "writing" });
      const write = job.format === "zip" ? writeSiteZip : writeSiteFolder;
      await write(built.files, job.destination, channel.signal);
      const { warnings } = built.report;
      return {
        type: "exported",
        pages: built.report.pages,
        files: built.report.files,
        bytes: built.report.bytes,
        // For the report, within the protocol's limits.
        warnings: warnings.slice(0, MAX_REPORTED_WARNINGS).map((warning) => ({
          code: warning.code,
          page: warning.page.slice(0, 1024),
          detail: warning.detail.slice(0, 2048),
        })),
        warningCount: warnings.length,
        durationMs: Math.round(performance.now() - started),
      };
    }
    return { type: "failed", code: "build-failed", detail: "unexpected" };
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
    if (error instanceof BuildError && error.code === "unreadable-image") {
      return {
        type: "failed",
        code: "unreadable-image",
        detail: error.code,
        ...(error.image === undefined ? {} : { image: error.image }),
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
