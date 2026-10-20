import type { CanvasEngine, Unsubscribe } from "@webforge/engine";
import type { NodeDoc, SiteDoc } from "@webforge/model";
import { EDITOR_RENDER_CONTEXT, renderNodesToHtml } from "@webforge/site-components";
import type { CanvasCssRequest, CanvasCssResult } from "../../shared/ipc/canvas.js";
import { withCanvasFonts } from "./canvas-fonts.js";
import type { EditorSession } from "./editor-session.js";

/** Compiles canvas CSS; in the app, `window.webforge.canvas.compileCss`. */
export type CompileCanvasCss = (request: CanvasCssRequest) => Promise<CanvasCssResult>;

/** How long the document must stay unchanged before its classes are collected again. */
export const SITE_CSS_DEBOUNCE_MS = 300;

/** Every class name the site's pages, Header and Footer use, sorted and without duplicates. */
export function siteClasses(site: SiteDoc, session: EditorSession): string[] {
  const lists: NodeDoc[][] = [
    site.layout.header,
    site.layout.footer,
    ...Object.values(site.pages).map((page) => page.doc.content),
  ];
  const html = lists
    .map((nodes) => renderNodesToHtml(nodes, session.library, EDITOR_RENDER_CONTEXT))
    .join("\n");
  const classes = new Set<string>();
  for (const match of html.matchAll(/\sclass="([^"]*)"/g)) {
    for (const name of (match[1] ?? "").split(/\s+/)) {
      // React escapes `&` in attributes; Tailwind needs the raw class name.
      if (name !== "") classes.add(name.replaceAll("&amp;", "&"));
    }
  }
  return [...classes].sort();
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
    void compile({ theme: site.theme, candidates }).then((result) => {
      if (!stopped && key === requested && result.status === "compiled") {
        engine.setSiteCss(withCanvasFonts(result.css, baseUrl), result.bodyClass);
      }
    });
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
