import type { NodeDoc, SharedSectionId, Theme } from "@webforge/model";
import {
  type ComponentLibrary,
  EDITOR_RENDER_CONTEXT,
  renderNodesToHtml,
} from "@webforge/site-components";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { withCanvasFonts } from "../editor/canvas-fonts.js";
import { type CompileCanvasCss, classesOfHtml } from "../editor/site-css.js";
import type { AddItem } from "./add-items.js";

/** How wide a section is drawn for its preview, in CSS pixels, before it is scaled down. */
const DRAWN_WIDTH = 1280;

/** How wide and at most how tall the preview is on screen. */
const PREVIEW = { width: 320, height: 200 } as const;

/** A section drawn for its preview: its markup, and the CSS its classes need. */
type Drawn = { readonly html: string; readonly css: string; readonly bodyClass: string };

/** What the previews need of the editor: the library, the site's theme, its CSS compiler. */
type PreviewSource = {
  readonly library: ComponentLibrary;
  /** The site's theme now, so a preview looks as the section will on this site. */
  readonly theme: () => Theme;
  /** The section a shared section stores, by its id, if the site has it. */
  readonly sharedSection: (id: SharedSectionId) => NodeDoc | undefined;
  readonly compileCss: CompileCanvasCss;
  /** The editor's base URL, for the canvas fonts the CSS refers to. */
  readonly baseUrl: string;
};

/**
 * Shows `drawn` scaled into the preview's size, in a shadow root: the site's CSS applies to the
 * section only, and the editor's styles not at all. The markup is the site library's own static
 * HTML for the section (defaults, or a shared section the site holds), as the export writes it.
 */
function PreviewFrame({ drawn }: { readonly drawn: Drawn }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = host.current;
    if (element === null) return;
    const root = element.shadowRoot ?? element.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `${drawn.css}\n.wf-preview { width: ${DRAWN_WIDTH}px; transform: scale(${
      PREVIEW.width / DRAWN_WIDTH
    }); transform-origin: top left; }`;
    const page = document.createElement("div");
    page.className = `wf-preview ${drawn.bodyClass}`;
    page.innerHTML = drawn.html;
    root.replaceChildren(style, page);
  }, [drawn]);
  return (
    <div
      ref={host}
      aria-hidden
      className="pointer-events-none overflow-hidden rounded-sm"
      style={{ width: PREVIEW.width, maxHeight: PREVIEW.height }}
    />
  );
}

/** A preview that draws its section the first time it is shown, then keeps it. */
function SectionPreview({ draw }: { readonly draw: () => Promise<Drawn | undefined> }) {
  const [drawn, setDrawn] = useState<Drawn | undefined>(undefined);
  useEffect(() => {
    let current = true;
    void draw().then((result) => {
      if (current) setDrawn(result);
    });
    return () => {
      current = false;
    };
  }, [draw]);
  return drawn === undefined ? (
    <div aria-hidden style={{ width: PREVIEW.width, height: PREVIEW.height / 2 }} />
  ) : (
    <PreviewFrame drawn={drawn} />
  );
}

/**
 * The Add panel's larger previews (F-ED-26, UX-10): a section, drawn with its defaults (or a
 * shared section as the site holds it) by the site library's static renderer, with the CSS its
 * classes need in the site's theme. Elements have none. Each is drawn once, and again only once
 * the theme or the shared section has changed.
 */
export function createSectionPreviews(source: PreviewSource): (item: AddItem) => ReactNode {
  /**
   * Each item's drawing, with the node and theme it was drawn from: drawn again once either
   * changes (a shared section or the theme edited; both are new objects then).
   */
  const drawings = new Map<
    string,
    {
      readonly node: NodeDoc;
      readonly theme: Theme;
      readonly drawing: Promise<Drawn | undefined>;
    }
  >();
  const drawers = new Map<string, () => Promise<Drawn | undefined>>();
  // A library section's node, with its defaults: made once, so its drawing is kept.
  const defaults = new Map<string, NodeDoc>();
  const nodeOf = (item: AddItem): NodeDoc | undefined => {
    if (item.sharedSectionId !== undefined) return source.sharedSection(item.sharedSectionId);
    const definition = source.library.components[item.type];
    if (definition === undefined || definition.place !== "section") return undefined;
    let node = defaults.get(item.type);
    if (node === undefined) {
      node = { type: item.type, props: { ...structuredClone(definition.defaults), id: "preview" } };
      defaults.set(item.type, node);
    }
    return node;
  };
  const draw = async (node: NodeDoc, theme: Theme): Promise<Drawn | undefined> => {
    const html = renderNodesToHtml([node], source.library, EDITOR_RENDER_CONTEXT);
    const result = await source.compileCss({
      theme,
      candidates: [...new Set(classesOfHtml(html))].sort(),
    });
    return result.status === "failed"
      ? undefined
      : { html, css: withCanvasFonts(result.css, source.baseUrl), bodyClass: result.bodyClass };
  };
  const drawerFor = (item: AddItem) => {
    let drawer = drawers.get(item.type);
    if (drawer === undefined) {
      drawer = () => {
        const node = nodeOf(item);
        if (node === undefined) return Promise.resolve(undefined);
        const theme = source.theme();
        const kept = drawings.get(item.type);
        if (kept !== undefined && kept.node === node && kept.theme === theme) return kept.drawing;
        const drawing = draw(node, theme).catch(() => undefined);
        drawings.set(item.type, { node, theme, drawing });
        return drawing;
      };
      drawers.set(item.type, drawer);
    }
    return drawer;
  };
  return (item) => (nodeOf(item) === undefined ? null : <SectionPreview draw={drawerFor(item)} />);
}
