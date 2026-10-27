import { createHash } from "node:crypto";
import { WebforgeError } from "@webforge/errors";
import {
  DOCUMENT_EXTENSIONS,
  isDeviceName,
  type MediaItem,
  type NodeDoc,
  type SitePage,
  type SiteSnapshot,
  siteSnapshotSchema,
} from "@webforge/model";
import {
  BEHAVIOUR_SCRIPTS,
  backToTopHtml,
  behavioursUsedBy,
  type ComponentLibrary,
  documentsLinkedBy,
  hrefFor,
  mediaUsedBy,
  navigationFor,
  type RenderContext,
  type RenderedPage,
  type ResolvedImage,
  renderPage,
  UnknownComponentError,
} from "@webforge/site-components";
import { fontFacesFor } from "@webforge/themes";
import { buildSiteCss, classCandidates, type SiteCssOptions, type StyleCompiler } from "./css.js";
import { developerFiles } from "./developer-files.js";
import { BODY_CLASS, iconLinks, pageDocument, type SiteIcon } from "./html.js";
import { imageForDepth, processImage } from "./images.js";
import { minifiedCss, minifiedHtml, minifiedJs } from "./minify.js";
import type { PipelineResources } from "./resources.js";
import { iconFiles, shareImageFile } from "./site-images.js";

/**
 * Why a build failed (X5 errors). The app shows a translated message for each code.
 * `missing-font`: a font the theme uses isn't installed as the catalogue lists it (2.2).
 * `cancelled`: the build's signal was aborted (R15).
 * `reserved-name`: a page or its folder is named after a Windows device (`con`, `aux`, `nul`…), so
 * its file can't be written there (R16).
 */
export type BuildErrorCode =
  | "invalid-site"
  | "unknown-component"
  | "missing-font"
  | "cancelled"
  | "reserved-name";

/** A build that cannot produce a working site. */
export class BuildError extends WebforgeError<BuildErrorCode> {
  override readonly name = "BuildError";
  /** The title of the page the build stopped at, for the message telling the person to fix it. */
  readonly page: string | undefined;

  constructor(
    code: BuildErrorCode,
    message: string,
    options?: ErrorOptions & { readonly page?: string },
  ) {
    super(
      code,
      code === "reserved-name" ? "export.failed.reservedName" : "export.failed.buildFailed",
      message,
      options,
    );
    this.page = options?.page;
  }
}

/**
 * A problem that does not stop the build (X5 warnings): a link to a page that isn't there, an
 * image deleted from Media that a page still places (that place is left out), a page *Minify
 * output* couldn't make smaller, as its HTML can't be read (it's written readable, 3.3), or a site
 * icon that gives no favicon (3.4): deleted from Media, or under 16 pixels once cut square.
 */
export type BuildWarning = {
  readonly code: "broken-link" | "missing-image" | "not-minified" | "missing-icon" | "small-icon";
  /** The page path the problem is on; "" for the whole site (the icon's). */
  readonly page: string;
  readonly detail: string;
};

/** The output of a build: every file of the site by relative path, plus a report. */
export type BuiltSite = {
  /** Paths use `/`, e.g. `index.html`, `assets/css/site.3f9a1c2b4d.css`. Sorted. */
  readonly files: ReadonlyMap<string, Uint8Array>;
  /**
   * Each page's share picture (3.4), by page path: the file among `files`, for its `og:image`
   * (3.5). A page with none, or whose image was deleted from Media, isn't in it.
   */
  readonly shareImages: ReadonlyMap<string, string>;
  /** The icon set made from Site Settings' icon (3.4), for the web app manifest (3.5). */
  readonly icons: readonly SiteIcon[];
  readonly report: {
    readonly pages: number;
    readonly files: number;
    readonly bytes: number;
    readonly warnings: readonly BuildWarning[];
  };
};

/**
 * How far a build has come (R15), for a progress bar: each image and page as it starts, then the
 * stylesheet and the fonts.
 */
export type BuildEvent =
  | { readonly stage: "images" | "pages"; readonly done: number; readonly total: number }
  | { readonly stage: "styles" | "fonts" };

/** The person's choices for what an export writes (3.3). Both are off unless asked for. */
export type OutputOptions = {
  /** *Minify output* (F-EX-3, X4): HTML, CSS and JS as small as is safe, instead of readable. */
  readonly minify?: boolean | undefined;
  /** *Include developer files* (F-EX-4, X6): the stylesheet's source and the theme, in `developer/`. */
  readonly developerFiles?: boolean | undefined;
};

/** How a build is run: a signal that cancels it, what to tell of its progress, what to write. */
export type BuildOptions = {
  /** Stops the build before its next image or page; it then throws a `cancelled` {@link BuildError}. */
  readonly signal?: AbortSignal | undefined;
  readonly onProgress?: ((event: BuildEvent) => void) | undefined;
  readonly output?: OutputOptions | undefined;
};

/**
 * What a build is for (architecture §6). An export and a publish build the same files; a preview
 * (3.2) lets its stylesheet keep classes between builds, so an edit's CSS is ready at once.
 */
export type BuildMode = "preview" | "export" | "publish";

/** A preview's stylesheet, by one name whatever it holds (3.2). */
export const PREVIEW_STYLESHEET = "assets/css/site.css";

/** A page's rendered regions, with the problems found rendering them. */
type RenderedRegions = RenderedPage & { readonly warnings: readonly BuildWarning[] };

/**
 * What a pipeline keeps between builds (3.1, `createPipeline`): its Tailwind compiler, and each
 * page's HTML under a hash of everything its render reads, so an unchanged page isn't rendered
 * again. Only the last finished build's pages are kept.
 */
export type BuildCaches = {
  readonly styles: StyleCompiler;
  readonly pages: Map<string, RenderedRegions>;
  /** Each font file checked against the catalogue's hash, by name: the same bytes aren't hashed again. */
  readonly fonts: Map<string, Uint8Array>;
};

/** How {@link buildEvents} runs: what for, its cancel signal, its output, the caches it may use. */
type BuildRun = {
  readonly mode: BuildMode;
  readonly signal?: AbortSignal | undefined;
  readonly output?: OutputOptions | undefined;
  readonly caches?: BuildCaches | undefined;
};

const EXTERNAL_LINK = /^(?:https?:|mailto:|tel:)/i;

const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");

function contentHash(data: string | Uint8Array): string {
  return sha256(data).slice(0, 10);
}

function depthOf(pagePath: string): number {
  return pagePath.split("/").length - 1;
}

/** Whether `page` has the back-to-top button: Site Settings ask for it, and it doesn't hide it. */
function showsBackToTop(site: SiteSnapshot, page: SitePage): boolean {
  return site.backToTop === true && page.hideBackToTop !== true;
}

/** Throws a `cancelled` {@link BuildError} once `signal` is aborted. */
function stopIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new BuildError("cancelled", "The build was cancelled");
}

/**
 * The original bytes of an image or document: the snapshot's own, or those the site stores under
 * its hash (R15). `mime`, when given, must be the stored type: a document is exported under its
 * type's extension. `undefined` when there are none.
 */
async function bytesOf(
  item: { readonly data?: Uint8Array | undefined; readonly hash?: string | undefined },
  resources: PipelineResources,
  mime?: string,
): Promise<Uint8Array | undefined> {
  if (item.data !== undefined) return item.data;
  if (item.hash === undefined || resources.readMedia === undefined) return undefined;
  const stored = await resources.readMedia(item.hash);
  if (stored === undefined || (mime !== undefined && stored.mime !== mime)) return undefined;
  return stored.data;
}

function allNodes(site: SiteSnapshot): NodeDoc[] {
  return [
    ...site.layout.header,
    ...site.layout.footer,
    ...site.pages.flatMap((page) => page.doc.content),
  ];
}

/**
 * Builds a self-contained static site from a snapshot (export pipeline stages 2–9): flat
 * `page.html` files with relative links (X1), readable CSS compiled from the classes used,
 * `webforge.js` only if needed, fonts, and responsive WebP + JPEG/PNG images (X2).
 *
 * Images and documents the snapshot names by hash are read through `resources.readMedia`, one at a
 * time; with `resources.imageCache`, an image encoded before isn't encoded again (R15). `options`
 * can cancel the build and follow its progress. `createPipeline` builds the same way, keeping what
 * it can between builds (3.1).
 */
export async function buildSite(
  snapshot: SiteSnapshot,
  library: ComponentLibrary,
  resources: PipelineResources,
  options: BuildOptions = {},
): Promise<BuiltSite> {
  const events = buildEvents(snapshot, library, resources, {
    mode: "export",
    signal: options.signal,
    output: options.output,
  });
  for (;;) {
    const next = await events.next();
    if (next.done === true) return next.value;
    options.onProgress?.(next.value);
  }
}

/**
 * The build of {@link buildSite}, as the events it goes through, finishing with the site. With
 * `run.caches`, a page or stylesheet unchanged since the last build is taken from them.
 */
export async function* buildEvents(
  snapshot: SiteSnapshot,
  library: ComponentLibrary,
  resources: PipelineResources,
  run: BuildRun,
): AsyncGenerator<BuildEvent, BuiltSite> {
  const { signal, caches } = run;
  const minify = run.output?.minify === true;
  const parsed = siteSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    throw new BuildError("invalid-site", parsed.error.message);
  }
  const site = parsed.data;
  // A page whose file Windows won't write (`con.html`, a folder `aux/`) stops the build before
  // anything else, naming the page, so the person can rename it (R16).
  const unwritable = site.pages.find((page) => page.path.split("/").some(isDeviceName));
  if (unwritable !== undefined) {
    throw new BuildError("reserved-name", "A page's name is one Windows keeps for a device", {
      page: unwritable.title,
    });
  }
  const text = new TextEncoder();
  const files = new Map<string, Uint8Array>();
  const warnings: BuildWarning[] = [];

  let behaviours: ReturnType<typeof behavioursUsedBy>;
  let mediaIds: Set<string>;
  let documentIds: Set<string>;
  try {
    behaviours = behavioursUsedBy(allNodes(site), library);
    if (site.pages.some((page) => showsBackToTop(site, page))) {
      behaviours = [...behaviours, "back-to-top" as const].sort();
    }
    mediaIds = mediaUsedBy(allNodes(site), library);
    documentIds = documentsLinkedBy(allNodes(site), library);
    // Documents the navigation menu links to are exported too.
    for (const item of site.menu?.items.flatMap((entry) =>
      entry.kind === "group" ? entry.children : [entry],
    ) ?? []) {
      if ((item.kind === "link" || item.kind === "button") && item.link.kind === "file") {
        documentIds.add(item.link.mediaId);
      }
    }
  } catch (error) {
    if (error instanceof UnknownComponentError) {
      throw new BuildError("unknown-component", error.message);
    }
    throw error;
  }

  // Images first: pages need their sizes and file names. An image deleted from Media while a page
  // still places it is left out there, with a warning, rather than failing the export (1.16).
  const images = new Map<string, ResolvedImage>();
  const missing = new Set<string>();
  const imageIds = [...mediaIds].sort();
  // The hash keys the cache, so an image found there is never read.
  const originalOf = (item: MediaItem) => ({
    hash: item.hash ?? sha256(item.data ?? new Uint8Array()),
    read: () => bytesOf(item, resources),
  });
  // The stage counts the favicon set and each share picture too (3.4), made after the images.
  const shareIds = [
    ...new Set(
      site.pages.flatMap((page) => (page.shareImage === undefined ? [] : [page.shareImage])),
    ),
  ];
  const imagesTotal = imageIds.length + (site.icon === undefined ? 0 : 1) + shareIds.length;
  let imagesDone = 0;
  for (const id of imageIds) {
    stopIfCancelled(signal);
    yield { stage: "images", done: imagesDone++, total: imagesTotal };
    const item = site.media.find((media) => media.id === id);
    if (item === undefined) {
      missing.add(id);
      continue;
    }
    const processed = await processImage(item, originalOf(item), resources.codecs, {
      cache: resources.imageCache,
    });
    if (processed === undefined) {
      missing.add(id);
      continue;
    }
    for (const file of processed.files) {
      files.set(`assets/img/${file.path}`, file.data);
    }
    images.set(id, processed.image);
  }

  // The favicon set from Site Settings' icon, and each page's share picture (3.4).
  const mediaById = new Map(site.media.map((item) => [item.id, item]));
  let icons: readonly SiteIcon[] = [];
  if (site.icon !== undefined) {
    stopIfCancelled(signal);
    yield { stage: "images", done: imagesDone++, total: imagesTotal };
    const icon = mediaById.get(site.icon);
    const made =
      icon === undefined
        ? undefined
        : await iconFiles(icon, originalOf(icon), resources.codecs, resources.imageCache);
    for (const file of made?.files ?? []) files.set(file.path, file.data);
    icons = made?.icons ?? [];
    // Deleted from Media since, or too small for the smallest icon: the site has no favicon.
    if (made === undefined) {
      warnings.push({ code: "missing-icon", page: "", detail: site.icon });
    } else if (made.files.length === 0) {
      warnings.push({ code: "small-icon", page: "", detail: site.icon });
    }
  }
  const shareFiles = new Map<string, string | undefined>();
  for (const id of shareIds) {
    stopIfCancelled(signal);
    yield { stage: "images", done: imagesDone++, total: imagesTotal };
    const item = mediaById.get(id);
    const made =
      item === undefined
        ? undefined
        : await shareImageFile(item, originalOf(item), resources.codecs, resources.imageCache);
    if (made !== undefined) files.set(made.path, made.data);
    shareFiles.set(id, made?.path);
  }
  const shareImages = new Map<string, string>();
  for (const page of site.pages) {
    if (page.shareImage === undefined) continue;
    const path = shareFiles.get(page.shareImage);
    if (path === undefined) {
      // Deleted from Media since: the page is shared without a picture.
      warnings.push({ code: "missing-image", page: page.path, detail: page.shareImage });
    } else {
      shareImages.set(page.path, path);
    }
  }

  // Documents pages link to, copied unchanged under their Media name (1.28). Documents nothing
  // links to aren't exported; a link to one deleted from Media goes nowhere, with a warning.
  const documentPaths = new Map<string, string>();
  for (const id of [...documentIds].sort()) {
    stopIfCancelled(signal);
    const item = site.documents?.find((document) => document.id === id);
    if (item === undefined) continue;
    const data = await bytesOf(item, resources, item.mimeType);
    if (data === undefined) continue;
    const path = `files/${item.name}.${DOCUMENT_EXTENSIONS[item.mimeType]}`;
    files.set(path, data);
    documentPaths.set(id, path);
  }

  const readableScript =
    behaviours.length === 0
      ? undefined
      : [
          "/* webforge.js: behaviours for this site's components. Classic script, no modules. */",
          // defineComponent checks every behaviour a component names is in behaviours/.
          ...behaviours.flatMap((name) => BEHAVIOUR_SCRIPTS[name]?.trim() ?? []),
          "",
        ].join("\n\n");
  // Minified before it's named, so its name still changes only when it does.
  const script =
    readableScript !== undefined && minify ? await minifiedJs(readableScript) : readableScript;
  const scriptPath =
    script === undefined ? undefined : `assets/js/webforge.${contentHash(script)}.js`;

  // Render every page, then compile one stylesheet from all the classes they use.
  const paths = new Set(site.pages.map((page) => page.path));
  const pathById = new Map(site.pages.map((page) => [page.id as string, page.path]));
  /** Renders `page`'s regions: its Header, content and Footer. */
  const render = (page: SitePage, prefix: string): RenderedRegions => {
    const found: BuildWarning[] = [];
    const navigation = navigationFor(
      site,
      page,
      prefix,
      (detail) => found.push({ code: "broken-link", page: page.path, detail }),
      (id) => documentPaths.get(id),
    );
    const context: RenderContext = {
      navigation,
      link: (target) => {
        if (EXTERNAL_LINK.test(target)) {
          return target;
        }
        if (paths.has(target)) {
          return `${prefix}${target}.html`;
        }
        found.push({ code: "broken-link", page: page.path, detail: target });
        return "#";
      },
      href: (link) => {
        const href = hrefFor(
          link,
          (id) => pathById.get(id),
          prefix,
          (id) => documentPaths.get(id),
        );
        if (href === undefined) {
          const detail =
            link.kind === "page" ? link.pageId : link.kind === "file" ? link.mediaId : link.kind;
          found.push({ code: "broken-link", page: page.path, detail });
          return "#";
        }
        return href;
      },
      image: (id) => {
        const image = images.get(id);
        if (image === undefined) {
          if (missing.has(id)) found.push({ code: "missing-image", page: page.path, detail: id });
          return null;
        }
        return imageForDepth(image, depthOf(page.path));
      },
      // An empty binding has no emptySetting here: the export leaves it out (1.17).
      setting: (key) => site.settings?.[key],
      openingHours: site.openingHours ?? [],
      socialProfiles: site.socialProfiles ?? [],
      language: site.language,
      ...(site.formService === undefined ? {} : { formService: site.formService }),
      // Custom Code as written (F-ED-15): the export is the one place it runs (3.9 checks it).
      rawCustomCode: true,
    };
    // The one static renderer (ADR 0005), whose render functions the canvas draws with too.
    const regions = {
      header: page.hideHeader === true ? [] : site.layout.header,
      content: page.doc.content,
      footer: page.hideFooter === true ? [] : site.layout.footer,
    };
    return { ...renderPage(regions, library, context), warnings: found };
  };
  // Everything a page's render reads besides the page itself, hashed once for the page cache: the
  // site without its pages' content and without Media, whose images and documents a page reaches
  // only as they were resolved above. A new input of rendering must be added here too.
  const sharedKey =
    caches === undefined
      ? ""
      : sha256(
          JSON.stringify({
            site: {
              ...site,
              media: undefined,
              documents: undefined,
              pages: site.pages.map((page) => ({ ...page, doc: undefined })),
            },
            images: [...images],
            missing: [...missing],
            documents: [...documentPaths],
          }),
        );
  const keptPages = new Map<string, RenderedRegions>();
  const rendered: (RenderedRegions & { readonly page: SitePage; readonly prefix: string })[] = [];
  for (const [done, page] of site.pages.entries()) {
    stopIfCancelled(signal);
    yield { stage: "pages", done, total: site.pages.length };
    const prefix = "../".repeat(depthOf(page.path));
    const key = caches === undefined ? undefined : sha256(`${sharedKey}\n${JSON.stringify(page)}`);
    const regions =
      (key === undefined ? undefined : caches?.pages.get(key)) ?? render(page, prefix);
    if (key !== undefined) keptPages.set(key, regions);
    warnings.push(...regions.warnings);
    rendered.push({ ...regions, page, prefix });
  }

  // The back-to-top button (F-CM-9) on the pages that show it, its classes compiled with theirs.
  const backToTop = backToTopHtml();
  const markup = rendered.flatMap((entry) => [
    entry.header,
    entry.main,
    entry.footer,
    showsBackToTop(site, entry.page) ? backToTop : "",
  ]);
  stopIfCancelled(signal);
  yield { stage: "styles" };
  const cssOptions: SiteCssOptions = {
    theme: site.theme,
    candidates: classCandidates([`<body class="${BODY_CLASS}">`, ...markup].join("\n")),
    fontsUrl: "../fonts/",
    ...(resources.fonts === undefined ? {} : { fonts: resources.fonts }),
  };
  const readableCss =
    caches === undefined
      ? await buildSiteCss(resources, cssOptions)
      : await caches.styles.css(cssOptions, run.mode === "preview");
  const css = minify ? minifiedCss(readableCss) : readableCss;
  // A preview's stylesheet keeps one name (3.2), so a change to the styles alone leaves every page
  // as it was and the browser swaps the stylesheet in place; an export's is named by its content.
  const cssPath =
    run.mode === "preview" ? PREVIEW_STYLESHEET : `assets/css/site.${contentHash(css)}.css`;
  files.set(cssPath, text.encode(css));
  for (const entry of rendered) {
    const page = {
      language: site.language,
      theme: site.theme.preset,
      title: entry.page.path === "index" ? site.name : `${entry.page.title} | ${site.name}`,
      description: entry.page.description,
      stylesheet: `${entry.prefix}${cssPath}`,
      script: scriptPath === undefined ? undefined : `${entry.prefix}${scriptPath}`,
      header: entry.header,
      main: entry.main,
      footer: entry.footer,
      ...(showsBackToTop(site, entry.page) ? { backToTop } : {}),
      // The favicon set's links first (3.4); 3.5's share and search tags follow them.
      head: iconLinks(icons, entry.prefix),
    };
    let html = pageDocument(page);
    if (minify) {
      try {
        html = await minifiedHtml(pageDocument(page, false));
      } catch {
        // HTML the minifier can't read (a broken tag in Custom Code): the page stays readable.
        warnings.push({ code: "not-minified", page: entry.page.path, detail: "" });
      }
    }
    files.set(`${entry.page.path}.html`, text.encode(html));
  }
  if (run.output?.developerFiles === true) {
    for (const [path, content] of developerFiles(site, cssOptions, cssPath)) {
      files.set(path, text.encode(content));
    }
  }
  if (script !== undefined && scriptPath !== undefined) {
    files.set(scriptPath, text.encode(script));
  }
  // Only the fonts the theme uses (2.2), each exactly the file the catalogue (or the download) lists.
  stopIfCancelled(signal);
  yield { stage: "fonts" };
  for (const face of fontFacesFor(site.theme, resources.fonts)) {
    const data = await resources.readFont(face);
    const checked = caches?.fonts.get(face.file);
    const known =
      checked !== undefined &&
      data !== undefined &&
      Buffer.from(checked.buffer, checked.byteOffset, checked.byteLength).equals(data);
    if (
      !known &&
      (data === undefined || data.byteLength !== face.bytes || sha256(data) !== face.sha256)
    ) {
      throw new BuildError("missing-font", `The font file ${face.file} is missing or damaged`);
    }
    if (data !== undefined) caches?.fonts.set(face.file, data);
    files.set(`assets/fonts/${face.file}`, data);
  }

  // This build's pages replace the last one's, so the cache holds no page that's gone.
  if (caches !== undefined) {
    caches.pages.clear();
    for (const [key, regions] of keptPages) caches.pages.set(key, regions);
  }
  const sorted = new Map([...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  let bytes = 0;
  for (const data of sorted.values()) bytes += data.length;
  return {
    files: sorted,
    shareImages,
    icons,
    report: { pages: site.pages.length, files: sorted.size, bytes, warnings },
  };
}
