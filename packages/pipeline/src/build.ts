import { createHash } from "node:crypto";
import { type NodeDoc, type SiteSnapshot, siteSnapshotSchema } from "@webforge/model";
import {
  BEHAVIOUR_SCRIPTS,
  behavioursUsedBy,
  type ComponentLibrary,
  mediaUsedBy,
  type NavLink,
  type RenderContext,
  type ResolvedImage,
  renderNodesToHtml,
  UnknownComponentError,
} from "@webforge/site-components";
import { buildSiteCss, classCandidates } from "./css.js";
import { BODY_CLASS, pageDocument } from "./html.js";
import { imageForDepth, processImage } from "./images.js";
import type { PipelineResources } from "./resources.js";

/** Why a build failed (X5 errors). The app shows a translated message for each code. */
export type BuildErrorCode = "invalid-site" | "unknown-component";

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

function contentHash(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex").slice(0, 10);
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
  try {
    behaviours = behavioursUsedBy(allNodes(site), library);
    mediaIds = mediaUsedBy(allNodes(site), library);
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

  const script =
    behaviours.length === 0
      ? undefined
      : [
          "/* webforge.js: behaviours for this site's components. Classic script, no modules. */",
          ...behaviours.map((name) => BEHAVIOUR_SCRIPTS[name].trim()),
          "",
        ].join("\n\n");
  const scriptPath =
    script === undefined ? undefined : `assets/js/webforge.${contentHash(script)}.js`;

  // Render every page, then compile one stylesheet from all the classes they use.
  const paths = new Set(site.pages.map((page) => page.path));
  const rendered = site.pages.map((page) => {
    const prefix = "../".repeat(depthOf(page.path));
    const navigation: NavLink[] = site.pages
      .filter((other) => other.hideFromNavigation !== true)
      .map((other) => ({
        label: other.navLabel ?? other.title,
        href: `${prefix}${other.path}.html`,
        current: other.path === page.path,
      }));
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
      image: (id) => {
        const image = images.get(id);
        if (image === undefined) {
          if (missing.has(id))
            warnings.push({ code: "missing-image", page: page.path, detail: id });
          return null;
        }
        return imageForDepth(image, depthOf(page.path));
      },
    };
    return {
      page,
      prefix,
      header:
        page.hideHeader === true ? "" : renderNodesToHtml(site.layout.header, library, context),
      main: renderNodesToHtml(page.doc.content, library, context),
      footer:
        page.hideFooter === true ? "" : renderNodesToHtml(site.layout.footer, library, context),
    };
  });

  const markup = rendered.flatMap((entry) => [entry.header, entry.main, entry.footer]);
  const css = await buildSiteCss(resources, {
    theme: site.theme.name,
    candidates: classCandidates([`<body class="${BODY_CLASS}">`, ...markup].join("\n")),
    fontsUrl: "../fonts/",
  });
  const cssPath = `assets/css/site.${contentHash(css)}.css`;
  files.set(cssPath, text.encode(css));
  for (const entry of rendered) {
    const html = pageDocument({
      language: site.language,
      theme: site.theme.name,
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
  for (const font of resources.fonts) {
    files.set(`assets/fonts/${font.fileName}`, font.data);
  }

  const sorted = new Map([...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  let bytes = 0;
  for (const data of sorted.values()) bytes += data.length;
  return {
    files: sorted,
    report: { pages: site.pages.length, files: sorted.size, bytes, warnings },
  };
}
