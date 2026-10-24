import { createHash } from "node:crypto";
import {
  DOCUMENT_EXTENSIONS,
  type NodeDoc,
  type SiteSnapshot,
  siteSnapshotSchema,
} from "@webforge/model";
import {
  BEHAVIOUR_SCRIPTS,
  behavioursUsedBy,
  type ComponentLibrary,
  documentsLinkedBy,
  mediaUsedBy,
  type RenderContext,
  type ResolvedImage,
  renderPage,
  UnknownComponentError,
} from "@webforge/site-components";
import { fontFacesFor } from "@webforge/themes";
import { buildSiteCss, classCandidates } from "./css.js";
import { BODY_CLASS, pageDocument } from "./html.js";
import { imageForDepth, processImage } from "./images.js";
import { hrefFor } from "./links.js";
import { navigationFor } from "./navigation.js";
import type { PipelineResources } from "./resources.js";

/** Why a build failed (X5 errors). The app shows a translated message for each code. */
/** `missing-font`: a font the theme uses isn't installed as the catalogue lists it (2.2). */
export type BuildErrorCode = "invalid-site" | "unknown-component" | "missing-font";

/** A build that cannot produce a working site. */
export class BuildError extends Error {
  readonly code: BuildErrorCode;

  constructor(code: BuildErrorCode, message: string) {
    super(message);
    this.name = "BuildError";
    this.code = code;
  }
}

/**
 * A problem that does not stop the build (X5 warnings): a link to a page that isn't there, or an
 * image deleted from Media that a page still places (that place is left out).
 */
export type BuildWarning = {
  readonly code: "broken-link" | "missing-image";
  /** The page path the problem is on. */
  readonly page: string;
  readonly detail: string;
};

/** The output of a build: every file of the site by relative path, plus a report. */
export type BuiltSite = {
  /** Paths use `/`, e.g. `index.html`, `assets/css/site.3f9a1c2b4d.css`. Sorted. */
  readonly files: ReadonlyMap<string, Uint8Array>;
  readonly report: {
    readonly pages: number;
    readonly files: number;
    readonly bytes: number;
    readonly warnings: readonly BuildWarning[];
  };
};

const EXTERNAL_LINK = /^(?:https?:|mailto:|tel:)/i;

const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");

function contentHash(data: string | Uint8Array): string {
  return sha256(data).slice(0, 10);
}

function depthOf(pagePath: string): number {
  return pagePath.split("/").length - 1;
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
 */
export async function buildSite(
  snapshot: SiteSnapshot,
  library: ComponentLibrary,
  resources: PipelineResources,
): Promise<BuiltSite> {
  const parsed = siteSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    throw new BuildError("invalid-site", parsed.error.message);
  }
  const site = parsed.data;
  const text = new TextEncoder();
  const files = new Map<string, Uint8Array>();
  const warnings: BuildWarning[] = [];

  let behaviours: ReturnType<typeof behavioursUsedBy>;
  let mediaIds: Set<string>;
  let documentIds: Set<string>;
  try {
    behaviours = behavioursUsedBy(allNodes(site), library);
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
  for (const id of [...mediaIds].sort()) {
    const item = site.media.find((media) => media.id === id);
    if (item === undefined) {
      missing.add(id);
      continue;
    }
    const processed = await processImage(item, resources.codecs);
    for (const file of processed.files) {
      files.set(`assets/img/${file.path}`, file.data);
    }
    images.set(id, processed.image);
  }

  // Documents pages link to, copied unchanged under their Media name (1.28). Documents nothing
  // links to aren't exported; a link to one deleted from Media goes nowhere, with a warning.
  const documentPaths = new Map<string, string>();
  for (const id of [...documentIds].sort()) {
    const item = site.documents?.find((document) => document.id === id);
    if (item === undefined) continue;
    const path = `files/${item.name}.${DOCUMENT_EXTENSIONS[item.mimeType]}`;
    files.set(path, item.data);
    documentPaths.set(id, path);
  }

  const script =
    behaviours.length === 0
      ? undefined
      : [
          "/* webforge.js: behaviours for this site's components. Classic script, no modules. */",
          // defineComponent checks every behaviour a component names is in behaviours/.
          ...behaviours.flatMap((name) => BEHAVIOUR_SCRIPTS[name]?.trim() ?? []),
          "",
        ].join("\n\n");
  const scriptPath =
    script === undefined ? undefined : `assets/js/webforge.${contentHash(script)}.js`;

  // Render every page, then compile one stylesheet from all the classes they use.
  const paths = new Set(site.pages.map((page) => page.path));
  const pathById = new Map(site.pages.map((page) => [page.id as string, page.path]));
  const rendered = site.pages.map((page) => {
    const prefix = "../".repeat(depthOf(page.path));
    const navigation = navigationFor(
      site,
      page,
      prefix,
      (detail) => warnings.push({ code: "broken-link", page: page.path, detail }),
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
        warnings.push({ code: "broken-link", page: page.path, detail: target });
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
          warnings.push({ code: "broken-link", page: page.path, detail });
          return "#";
        }
        return href;
      },
      image: (id) => {
        const image = images.get(id);
        if (image === undefined) {
          if (missing.has(id))
            warnings.push({ code: "missing-image", page: page.path, detail: id });
          return null;
        }
        return imageForDepth(image, depthOf(page.path));
      },
      // An empty binding has no emptySetting here: the export leaves it out (1.17).
      setting: (key) => site.settings?.[key],
    };
    // The one static renderer (ADR 0005), whose render functions the canvas draws with too.
    const regions = {
      header: page.hideHeader === true ? [] : site.layout.header,
      content: page.doc.content,
      footer: page.hideFooter === true ? [] : site.layout.footer,
    };
    return { page, prefix, ...renderPage(regions, library, context) };
  });

  const markup = rendered.flatMap((entry) => [entry.header, entry.main, entry.footer]);
  const css = await buildSiteCss(resources, {
    theme: site.theme,
    candidates: classCandidates([`<body class="${BODY_CLASS}">`, ...markup].join("\n")),
    fontsUrl: "../fonts/",
    ...(resources.fonts === undefined ? {} : { fonts: resources.fonts }),
  });
  const cssPath = `assets/css/site.${contentHash(css)}.css`;
  files.set(cssPath, text.encode(css));
  for (const entry of rendered) {
    const html = pageDocument({
      language: site.language,
      theme: site.theme.preset,
      title: entry.page.path === "index" ? site.name : `${entry.page.title} | ${site.name}`,
      description: entry.page.description,
      stylesheet: `${entry.prefix}${cssPath}`,
      script: scriptPath === undefined ? undefined : `${entry.prefix}${scriptPath}`,
      header: entry.header,
      main: entry.main,
      footer: entry.footer,
    });
    files.set(`${entry.page.path}.html`, text.encode(html));
  }
  if (script !== undefined && scriptPath !== undefined) {
    files.set(scriptPath, text.encode(script));
  }
  // Only the fonts the theme uses (2.2), each exactly the file the catalogue (or the download) lists.
  for (const face of fontFacesFor(site.theme, resources.fonts)) {
    const data = await resources.readFont(face);
    if (data === undefined || data.byteLength !== face.bytes || sha256(data) !== face.sha256) {
      throw new BuildError("missing-font", `The font file ${face.file} is missing or damaged`);
    }
    files.set(`assets/fonts/${face.file}`, data);
  }

  const sorted = new Map([...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  let bytes = 0;
  for (const data of sorted.values()) bytes += data.length;
  return {
    files: sorted,
    report: { pages: site.pages.length, files: sorted.size, bytes, warnings },
  };
}
