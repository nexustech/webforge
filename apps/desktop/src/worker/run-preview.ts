import type { Pipeline, PipelineResources, StoredMedia } from "@webforge/pipeline";
import { BuildError } from "@webforge/pipeline";
import { FONT_CATALOGUE } from "@webforge/themes";
import type { PreviewJob, PreviewOutcome } from "../shared/export-worker-protocol.js";

/** What a preview build reaches outside the worker: the site's stored bytes, and its pipeline. */
export type PreviewChannel = {
  /** The bytes the open site stores under a hash, asked of the main process one at a time (R15). */
  readonly readMedia: (hash: string) => Promise<StoredMedia | undefined>;
  /** The preview's own pipeline: its pages, images and stylesheet kept between builds (3.1). */
  readonly pipeline: Pipeline;
};

/** Whether two files hold the same bytes. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let at = 0; at < a.byteLength; at++) if (a[at] !== b[at]) return false;
  return true;
}

/**
 * Builds the open site for the preview server (3.2), keeping its files for the next build: it
 * answers with those that changed since the last and those gone, so an edit sends the main
 * process a page or a stylesheet, not every image again. With nothing from before (a new worker),
 * it answers with every file, `full`.
 */
export function createPreviewBuilds(
  loadResources: () => Promise<PipelineResources>,
  channel: PreviewChannel,
): (job: PreviewJob) => Promise<PreviewOutcome> {
  let last: ReadonlyMap<string, Uint8Array> | undefined;
  return async (job) => {
    try {
      const fonts = new Map(job.fonts.map((font) => [font.file, font.data]));
      const resources = {
        ...(await loadResources()),
        readFont: async (face: { readonly file: string }) => fonts.get(face.file),
        fonts: [...FONT_CATALOGUE, ...job.families],
        readMedia: channel.readMedia,
      };
      for await (const event of channel.pipeline.build(job.snapshot, resources, {
        mode: "preview",
      })) {
        if (event.stage !== "done") continue;
        const { files } = event.site;
        const before = last;
        last = files;
        const changed = [...files]
          .filter(([path, data]) => {
            const was = before?.get(path);
            return was === undefined || !sameBytes(was, data);
          })
          .map(([path, data]) => ({ path, data }));
        const removed = before === undefined ? [] : [...before.keys()].filter((p) => !files.has(p));
        return { type: "previewed", full: before === undefined, changed, removed };
      }
      return { type: "preview-failed", detail: "unexpected" };
    } catch (error) {
      return {
        type: "preview-failed",
        detail: error instanceof BuildError ? error.code : "unexpected",
      };
    }
  };
}
