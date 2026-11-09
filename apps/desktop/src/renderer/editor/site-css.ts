import type { CanvasEngine, Unsubscribe } from "@webforge/engine";
import type { NodeDoc, PageId, SiteDoc } from "@webforge/model";
import {
  BOX_CLASS_SAFELIST,
  EDITOR_RENDER_CONTEXT,
  type RenderContext,
  type ResolvedImage,
  renderNodesToHtml,
} from "@webforge/site-components";
import type { CanvasCssRequest, CanvasCssResult } from "../../shared/ipc/canvas.js";
import type { EditorSession } from "./editor-session.js";

/** Compiles canvas CSS; in the app, `window.webforge.canvas.compileCss`. */
export type CompileCanvasCss = (request: CanvasCssRequest) => Promise<CanvasCssResult>;

/** How long the document must stay unchanged before its classes are collected again. */
export const SITE_CSS_DEBOUNCE_MS = 300;

/**
 * The classes of each list of nodes rendered so far. The document shares unchanged lists between
 * versions, so after an edit only the changed page is rendered again.
 */
const classesOfList = new WeakMap<
  readonly NodeDoc[],
  { readonly looks: RenderContext["looks"]; readonly classes: readonly string[] }
>();

/** The image every placed image renders as while classes are collected: which one never matters. */
const PLACEHOLDER_IMAGE: ResolvedImage = {
  sources: [],
  src: "",
  fallback: { type: "image/png", srcset: "" },
  width: 1,
  height: 1,
  alt: "",
};

/**
 * What classes are collected with (#371): the editor's context, rendered twice, once with every
 * placed image resolving and once with none, an Image without one showing its hint either way. The
 * canvas can show an element either way at any moment (an image picked, or removed from Media, or a
 * new Gallery image), so both are compiled before it does. With the editor's context alone, images
 * rendered nothing, so none of their classes were compiled. Only whether an image resolves changes
 * an element's classes, never which image or its alt text, so a change to Media collects nothing
 * again.
 */
const CLASS_CONTEXTS: readonly RenderContext[] = [
  { ...EDITOR_RENDER_CONTEXT, image: () => PLACEHOLDER_IMAGE, emptyImage: () => "" },
  { ...EDITOR_RENDER_CONTEXT, image: () => null, emptyImage: () => "" },
];

/** The class names in static `html`, in order, repeats included. */
export function classesOfHtml(html: string): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(/\sclass="([^"]*)"/g)) {
    // React escapes `&`, `<`, `>` and quotes in attributes; Tailwind needs the raw class name
    // (`[&>*:first-child]:col-span-2`). The same rule as the export pipeline's classCandidates,
    // which the renderer can't import: `&amp;` last, so `&amp;gt;` stays `&gt;`.
    found.push(
      ...(match[1] ?? "")
        .split(/\s+/)
        .map((name) =>
          name
            .replaceAll("&lt;", "<")
            .replaceAll("&gt;", ">")
            .replaceAll("&quot;", '"')
            .replaceAll("&#x27;", "'")
            .replaceAll("&amp;", "&"),
        ),
    );
  }
  return found.filter((name) => name !== "");
}

function listClasses(
  nodes: readonly NodeDoc[],
  session: EditorSession,
  looks: RenderContext["looks"],
): readonly string[] {
  const kept = classesOfList.get(nodes);
  // Drawn with the theme's looks (3.12): a change to them collects the list's classes again.
  if (kept !== undefined && kept.looks === looks) return kept.classes;
  // Hidden elements too: the canvas shows them, dimmed, so it needs their styles (#142).
  const classes = CLASS_CONTEXTS.flatMap((context) =>
    classesOfHtml(
      renderNodesToHtml(
        nodes,
        session.library,
        looks === undefined ? context : { ...context, looks },
        { includeHidden: true },
      ),
    ),
  );
  classesOfList.set(nodes, { looks, classes });
  return classes;
}

/** Whether `nodes`' classes are collected already, with the theme's `looks`. */
function listCollected(nodes: readonly NodeDoc[], looks: RenderContext["looks"]): boolean {
  return classesOfList.get(nodes)?.looks === looks;
}

/** The site's lists of nodes whose classes are collected: the Header, the Footer and each page. */
function siteLists(site: SiteDoc): readonly (readonly NodeDoc[])[] {
  return [
    site.layout.header,
    site.layout.footer,
    ...Object.values(site.pages).map((page) => page.doc.content),
  ];
}

/** The classes of `lists` and every spacing class (1.32), sorted and without duplicates. */
function classesOfLists(
  lists: readonly (readonly NodeDoc[])[],
  site: SiteDoc,
  session: EditorSession,
): string[] {
  return [
    ...new Set([
      ...lists.flatMap((nodes) => listClasses(nodes, session, site.theme.looks)),
      ...BOX_CLASS_SAFELIST,
    ]),
  ].sort();
}

/**
 * Every class name the site's pages, Header and Footer use, and every spacing class a spacing
 * handle can drag to (1.32), sorted and without duplicates.
 */
export function siteClasses(site: SiteDoc, session: EditorSession): string[] {
  return classesOfLists(siteLists(site), site, session);
}

/**
 * The classes of what the canvas shows now (#895): the Header, the Footer and the page `pageId`,
 * with the spacing classes, as {@link siteClasses} has them.
 */
export function shownClasses(site: SiteDoc, session: EditorSession, pageId: PageId): string[] {
  const page = site.pages[pageId];
  return classesOfLists(
    [site.layout.header, site.layout.footer, ...(page === undefined ? [] : [page.doc.content])],
    site,
    session,
  );
}

/**
 * Keeps the canvas styled with the site's own CSS (1.12), compiled by the export pipeline in a
 * utility process. It recompiles only when the set of classes the site uses or its theme changes,
 * checked once the document has been still for {@link SITE_CSS_DEBOUNCE_MS}; a failed compile
 * leaves the last styles in place. An answer older than the styles shown is dropped; one a newer
 * request has overtaken is still shown until that one's comes, as it is newer than what's shown.
 *
 * Collecting a site's classes renders every page twice, 0.1–0.2 s for a template's site and up to
 * 3 s for a large one of 20 pages, on the editor's thread (#895). So the first compile asks only for
 * what the canvas shows (the Header, the Footer and the shown page, again if another is shown
 * meanwhile), and the other pages' classes are collected one page at a time between the editor's
 * other work, then compiled with the rest, before the person is likely to show another page.
 */
export function connectSiteCss(
  engine: CanvasEngine,
  session: EditorSession,
  compile: CompileCanvasCss,
): Unsubscribe {
  /** What was last sent to compile: the theme (any token change makes a new one) and the classes. */
  let requested: { readonly theme: unknown; readonly classes: string } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** The next page's collection while every page's classes aren't collected yet. */
  let collecting: ReturnType<typeof setTimeout> | null = null;
  /** Whether every page's classes have been collected once: compiles ask for the whole site. */
  let collected = false;
  /** How many compiles have been sent, and which of them the canvas shows (0: none yet). */
  let sent = 0;
  let shown = 0;
  let stopped = false;

  /** Collects one more list's classes, from the latest document, then the next after a pause. */
  const collectNext = () => {
    collecting = null;
    const site = session.history.document.getState();
    const next = siteLists(site).find((nodes) => !listCollected(nodes, site.theme.looks));
    if (next !== undefined) {
      try {
        listClasses(next, session, site.theme.looks);
        collecting = setTimeout(collectNext, 0);
        return;
      } catch {
        // A component the library lacks: the whole site's update below fails as it always has.
      }
    }
    collected = true;
    stopShown();
    update();
  };

  // A page shown before every page is collected is compiled at once, as the first was.
  const stopShown = session.ui.subscribe((state, previous) => {
    if (!collected && state.pageId !== previous.pageId) update();
  });

  const update = () => {
    timer = null;
    const site = session.history.document.getState();
    let candidates: string[];
    try {
      candidates = collected
        ? siteClasses(site, session)
        : shownClasses(site, session, session.ui.getState().pageId);
    } catch {
      // A component the library lacks; the canvas reports it on its own.
      return;
    } finally {
      if (!collected && collecting === null) {
        collecting = setTimeout(collectNext, 0);
      }
    }
    // Any change to the theme's tokens compiles again (2.1), as a change to the classes does.
    const classes = candidates.join(" ");
    if (requested?.theme === site.theme && requested.classes === classes) {
      return;
    }
    const key = { theme: site.theme, classes };
    requested = key;
    const failed = () => {
      // Try again after the next change, even if the classes stay the same.
      if (key === requested) requested = null;
    };
    sent += 1;
    const order = sent;
    compile({ theme: site.theme, candidates }).then((result) => {
      if (result.status === "failed") {
        failed();
      } else if (!stopped && order > shown) {
        // The first styles needn't wait for the whole site's (#895), nor any for the latest edit's.
        shown = order;
        engine.setSiteCss(result.css, result.bodyClass);
      }
    }, failed);
  };

  update();
  const unsubscribe = session.history.document.subscribe(() => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(update, SITE_CSS_DEBOUNCE_MS);
  });
  return () => {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
    if (collecting !== null) clearTimeout(collecting);
    stopShown();
    unsubscribe();
  };
}
