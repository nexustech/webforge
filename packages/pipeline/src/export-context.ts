import type { BundledFile, NodeDoc, SitePage, SiteSnapshot } from "@webforge/model";
import {
  hrefFor,
  navigationFor,
  type RenderContext,
  type ResolvedImage,
} from "@webforge/site-components";
import { imageAt } from "./images.js";
import { toBundled, withCustomCode } from "./site-code.js";
import { NOT_FOUND_PATH } from "./site-files.js";

/**
 * A problem that does not stop the build (X5 warnings): a link to a page that isn't there, an
 * image deleted from Media that a page still places (that place is left out), a page *Minify
 * output* couldn't make smaller, as its HTML can't be read (it's written readable, 3.3), or a site
 * icon that gives no favicon (3.4): deleted from Media, or under 16 pixels once cut square; or a
 * form with nowhere to send (`form-unset`, 3.7: no form service, Netlify Forms before its
 * publisher, an address that isn't `https://`, or a Newsletter without its address; `detail` says
 * which), the site's `custom.js` with a mistake that stops browsers running it (`custom-script`,
 * 3.9; `detail` is its line), or a file kept with the site whose bytes the site file doesn't have
 * (`missing-kept-file`, 3.9; `detail` is its name), whose address its code keeps.
 */
export type BuildWarning = {
  readonly code:
    | "broken-link"
    | "missing-image"
    | "not-minified"
    | "missing-icon"
    | "small-icon"
    | "form-unset"
    | "custom-script"
    | "missing-kept-file";
  /** The page path the problem is on; "" for the whole site (the icon's). */
  readonly page: string;
  readonly detail: string;
};

const EXTERNAL_LINK = /^(?:https?:|mailto:|tel:)/i;

/**
 * The path from `page` to the site's root, which its links and files start with: `../` per folder,
 * or `rootPrefix` for the "Page not found" page, which is served at any missing address (F-ED-20).
 */
export function pagePrefix(page: SitePage, rootPrefix: string): string {
  return page.path === NOT_FOUND_PATH ? rootPrefix : "../".repeat(page.path.split("/").length - 1);
}

/** What a page's render reads besides the site and the page: the files the export made for them. */
export type PageRenderFiles = {
  /** The images pages place, by Media id, at the site's root: as the export writes them. */
  readonly images: ReadonlyMap<string, ResolvedImage>;
  /** Images pages place that Media no longer has (or couldn't be read): warned about. */
  readonly missing: ReadonlySet<string>;
  /** The documents pages link to, by Media id: their path in the site. */
  readonly documentPaths: ReadonlyMap<string, string>;
  /** The files kept with the site (3.9), which Custom Code is drawn pointing at. */
  readonly bundled: readonly BundledFile[];
  /** The thank-you page's address, where forms send visitors after sending (3.7). */
  readonly thanksPage?: string | undefined;
  /** Whether the Footer links back to the consent banner (#539). */
  readonly cookieSettings: boolean;
};

/** A page ready to render: its context, its regions, and what it warns about as it renders. */
export type PageRender = {
  readonly context: RenderContext;
  /** The Header and Footer it shows (none where its Page Settings hide them) and its content. */
  readonly regions: {
    readonly header: readonly NodeDoc[];
    readonly content: readonly NodeDoc[];
    readonly footer: readonly NodeDoc[];
  };
  /** Filled as the page renders: broken links, missing images, forms with nowhere to send. */
  readonly warnings: readonly BuildWarning[];
};

/**
 * `page` of `site` as the export renders it (ADR 0005), `prefix` from the site's root: links and
 * files relative to it, the menu, Site Settings' bindings, each kind's look (3.12) and Custom Code
 * as written. The build renders every page with it, and Advanced mode's CSS tab one item (3.14), so
 * the two never differ.
 */
export function pageRender(
  site: SiteSnapshot,
  page: SitePage,
  prefix: string,
  files: PageRenderFiles,
): PageRender {
  const { images, missing, documentPaths, bundled, thanksPage, cookieSettings } = files;
  const warnings: BuildWarning[] = [];
  const paths = new Set(site.pages.map((each) => each.path));
  const pathById = new Map(site.pages.map((each) => [each.id as string, each.path]));
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
        if (missing.has(id)) warnings.push({ code: "missing-image", page: page.path, detail: id });
        return null;
      }
      return imageAt(image, prefix);
    },
    // An empty binding has no emptySetting here: the export leaves it out (1.17).
    setting: (key) => site.settings?.[key],
    openingHours: site.openingHours ?? [],
    socialProfiles: site.socialProfiles ?? [],
    language: site.language,
    ...(site.formService === undefined ? {} : { formService: site.formService }),
    // Custom Code as written (F-ED-15): the export is the one place it runs (3.9 checks it).
    rawCustomCode: true,
    // Each kind's look from the theme (3.12, CT-1), under what an element sets itself.
    ...(site.theme.looks === undefined ? {} : { looks: site.theme.looks }),
    // A form with nowhere to send draws without an action (2.8), and the report says so (3.7).
    formHint: (reason) => {
      warnings.push({ code: "form-unset", page: page.path, detail: reason });
      return null;
    },
    ...(thanksPage === undefined ? {} : { thanksPage }),
    // The Footer's link back to the consent banner, wherever it asks (#539).
    ...(cookieSettings ? { cookieSettings: true } : {}),
  };
  // Custom Code pointing at the files kept with the site, `prefix` away (3.9).
  const own = (nodes: readonly NodeDoc[]) =>
    bundled.length === 0 ? nodes : withCustomCode(nodes, toBundled(bundled, prefix));
  return {
    context,
    regions: {
      header: page.hideHeader === true ? [] : own(site.layout.header),
      content: own(page.doc.content),
      footer: page.hideFooter === true ? [] : own(site.layout.footer),
    },
    warnings,
  };
}
