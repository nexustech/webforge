import { makeThumbnail, type PipelineResources } from "@webforge/pipeline";
import type { ThumbnailJob, ThumbnailOutcome } from "../shared/export-worker-protocol.js";

/** Makes the WebP preview of a Media image (1.16). Never throws: a broken image just fails. */
export async function thumbnailFor(
  job: ThumbnailJob,
  loadResources: () => Promise<Pick<PipelineResources, "codecs">>,
): Promise<ThumbnailOutcome> {
  try {
    const { codecs } = await loadResources();
    return {
      type: "thumbnail",
      data: await makeThumbnail(job.data, job.mimeType, codecs),
    };
  } catch {
    return { type: "thumbnail-failed" };
  }
}
