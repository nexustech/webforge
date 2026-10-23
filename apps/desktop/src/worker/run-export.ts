import {
  BuildError,
  buildSite,
  type PipelineResources,
  WriteError,
  writeSiteFolder,
} from "@webforge/pipeline";
import { siteLibrary } from "@webforge/site-components";
import { FONT_CATALOGUE } from "@webforge/themes";
import type { ExportJob, ExportOutcome } from "../shared/export-worker-protocol.js";

/** Builds the site of `job` and writes it to its destination; never throws. */
export async function runExport(
  job: ExportJob,
  loadResources: () => Promise<PipelineResources>,
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
    };
    const built = await buildSite(job.snapshot, siteLibrary, resources);
    await writeSiteFolder(built.files, job.destination);
    return {
      type: "exported",
      pages: built.report.pages,
      files: built.report.files,
      bytes: built.report.bytes,
      warnings: built.report.warnings.length,
      durationMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    if (error instanceof BuildError) {
      return { type: "failed", code: "build-failed", detail: error.code };
    }
    if (error instanceof WriteError) {
      return { type: "failed", code: error.code, detail: error.code };
    }
    return { type: "failed", code: "build-failed", detail: "unexpected" };
  }
}
