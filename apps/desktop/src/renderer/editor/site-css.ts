import type { CanvasEngine, Unsubscribe } from "@webforge/engine";
import type { NodeDoc, SiteDoc } from "@webforge/model";
import {
  BOX_CLASS_SAFELIST,
  EDITOR_RENDER_CONTEXT,
  renderNodesToHtml,
} from "@webforge/site-components";
import type { CanvasCssRequest, CanvasCssResult } from "../../shared/ipc/canvas.js";
import { withCanvasFonts } from "./canvas-fonts.js";
import type { EditorSession } from "./editor-session.js";

/** Compiles canvas CSS; in the app, `window.webforge.canvas.compileCss`. */
export type CompileCanvasCss = (request: CanvasCssRequest) => Promise<CanvasCssResult>;

/** How long the document must stay unchanged before its classes are collected again. */
export const SITE_CSS_DEBOUNCE_MS = 300;

/**
 * The classes of each list of nodes rendered so far. The document shares unchanged lists between
 * versions, so after an edit only the changed page is rendered again.
 */
const classesOfList = new WeakMap<readonly NodeDoc[], readonly string[]>();

/** The class names in static `html`, in order, repeats included. */
export function classesOfHtml(html: string): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(/\sclass="([^"]*)"/g)) {
    // React escapes `&` in attributes; Tailwind needs the raw class name. The same rule as the
    // export pipeline's classCandidates, which the renderer can't import.
    found.push(...(match[1] ?? "").split(/\s+/).map((name) => name.replaceAll("&amp;", "&")));
  }
  return found.filter((name) => name !== "");
}

function listClasses(nodes: readonly NodeDoc[], session: EditorSession): readonly string[] {
  let classes = classesOfList.get(nodes);
  if (classes === undefined) {
    // Hidden elements too: the canvas shows them, dimmed, so it needs their styles (#142).
    const html = renderNodesToHtml(nodes, session.library, EDITOR_RENDER_CONTEXT, {
      includeHidden: true,
    });
    classes = classesOfHtml(html);
    classesOfList.set(nodes, classes);
  }
  return classes;
}

/**
 * Every class name the site's pages, Header and Footer use, and every spacing class a spacing
 * handle can drag to (1.32), sorted and without duplicates.
 */
export function siteClasses(site: SiteDoc, session: EditorSession): string[] {
  const lists: readonly NodeDoc[][] = [
    site.layout.header,
    site.layout.footer,
    ...Object.values(site.pages).map((page) => page.doc.content),
  ];
  return [
    ...new Set([...lists.flatMap((nodes) => listClasses(nodes, session)), ...BOX_CLASS_SAFELIST]),
  ].sort();
}

/**
 * Keeps the canvas styled with the site's own CSS (1.12), compiled by the export pipeline in a
 * utility process. It recompiles only when the set of classes the site uses or its theme changes,
 * checked once the document has been still for {@link SITE_CSS_DEBOUNCE_MS}; a failed compile
 * leaves the last styles in place. An answer that a newer request has overtaken is dropped.
 */
export function connectSiteCss(
  engine: CanvasEngine,
  session: EditorSession,
  compile: CompileCanvasCss,
  baseUrl: string,
): Unsubscribe {
  let requested = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const update = () => {
    timer = null;
    const site = session.history.document.getState();
    let candidates: string[];
    try {
      candidates = siteClasses(site, session);
    } catch {
      // A component the library lacks; the canvas reports it on its own.
      return;
    }
    const key = `${site.theme.name}\n${candidates.join(" ")}`;
    if (key === requested) {
      return;
    }
    requested = key;
    const failed = () => {
      // Try again after the next change, even if the classes stay the same.
      if (key === requested) requested = "";
    };
    compile({ theme: site.theme, candidates }).then((result) => {
      if (result.status === "failed") {
        failed();
      } else if (!stopped && key === requested) {
        engine.setSiteCss(withCanvasFonts(result.css, baseUrl), result.bodyClass);
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
    unsubscribe();
  };
}
