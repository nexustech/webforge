import type { SiteSnapshot } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import {
  type BuildCaches,
  type BuildEvent,
  type BuildMode,
  type BuiltSite,
  buildEvents,
  type OutputOptions,
} from "./build.js";
import { createStyleCompiler } from "./css.js";
import { createMemoryImageCache } from "./memory-image-cache.js";
import type { PipelineResources } from "./resources.js";

/** What a pipeline's build goes through: the stages of {@link BuildEvent}, then the site. */
export type PipelineEvent = BuildEvent | { readonly stage: "done"; readonly site: BuiltSite };

/** How one build of a {@link Pipeline} runs. */
export type PipelineBuildOptions = {
  readonly mode: BuildMode;
  /** Stops the build before its next image or page; it then throws a `cancelled` `BuildError`. */
  readonly signal?: AbortSignal | undefined;
  /** What the export writes besides the site: minified files, developer files. */
  readonly output?: OutputOptions | undefined;
  /** The year `{year}` stands for (F-CM-8): this year when left out. */
  readonly year?: number | undefined;
};

/** Builds one open site, as often as asked, keeping between builds what it can (3.1). */
export type Pipeline = {
  /**
   * Builds `snapshot` (architecture §6), as the events it goes through, the last carrying the
   * site. It throws as `buildSite` does. Tailwind's stylesheets and plugins in `resources` must be
   * the same for every build.
   */
  build(
    snapshot: SiteSnapshot,
    resources: PipelineResources,
    options: PipelineBuildOptions,
  ): AsyncIterable<PipelineEvent>;
};

/** Options of {@link createPipeline}. */
export type PipelineOptions = {
  /** At most this many bytes of encoded images are kept for the next build: 256 MB by default. */
  readonly imageCacheBytes?: number;
};

const IMAGE_CACHE_BYTES = 256 * 1024 * 1024;

/**
 * A pipeline for one open site (3.1). Between builds it keeps, in memory only (R15):
 * - each image it encoded, so a re-export reads and encodes only new or changed images;
 * - each page's HTML, under a hash of everything its render reads;
 * - its Tailwind compiler, and the classes it has seen.
 *
 * An export's files are always those `buildSite` would write; only a preview's stylesheet may keep
 * classes a page no longer uses. Drop the pipeline when the site closes, and its caches go with it.
 */
export function createPipeline(library: ComponentLibrary, options: PipelineOptions = {}): Pipeline {
  const images = createMemoryImageCache(options.imageCacheBytes ?? IMAGE_CACHE_BYTES);
  let caches: BuildCaches | undefined;
  return {
    async *build(snapshot, resources, { mode, signal, output, year }) {
      caches ??= { styles: createStyleCompiler(resources), pages: new Map() };
      const site = yield* buildEvents(
        snapshot,
        library,
        { ...resources, imageCache: resources.imageCache ?? images },
        { mode, signal, output, caches, year },
      );
      yield { stage: "done", site };
    },
  };
}
