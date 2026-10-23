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

/** How much the drawn section is scaled down to fit the preview's width. */
const SCALE = PREVIEW.width / DRAWN_WIDTH;

/**
 * A section drawn for its preview: its markup, the CSS its classes need (without its font faces),
 * the font faces, the page classes that set its colours and font, and the site's theme name.
 */
type Drawn = {
  readonly html: string;
  readonly css: string;
  readonly fontFaces: readonly string[];
  readonly pageClass: string;
  readonly theme: string;
};

/** Exported pages' `<body>` classes that lay out a whole page; a preview is one section. */
const WHOLE_PAGE_CLASSES = new Set(["flex", "flex-col", "min-h-screen"]);

/** The `@font-face` rules in compiled CSS. */
const FONT_FACE = /@font-face\s*\{[^}]*\}/g;

/** Marks the editor document's one `<style>` element with the previews' font faces. */
const FONT_STYLE_ATTRIBUTE = "data-webforge-preview-fonts";

/**
 * Adds `faces` to `document`'s own styles, once each: a font face declared in a shadow root
 * isn't used there (Chromium), so the previews' fonts are declared for the whole editor window.
 * Only the site's own font files, which the editor bundles, are referred to.
 */
function registerFontFaces(document: Document, faces: readonly string[]): void {
  if (faces.length === 0) return;
  let element = document.head.querySelector<HTMLStyleElement>(`style[${FONT_STYLE_ATTRIBUTE}]`);
  if (element === null) {
    element = document.createElement("style");
    element.setAttribute(FONT_STYLE_ATTRIBUTE, "");
    document.head.append(element);
  }
  const known = new Set(element.textContent.split("\n").filter((rule) => rule !== ""));
  const added = faces.filter((face) => !known.has(face));
  if (added.length > 0) element.textContent = [...known, ...added].join("\n");
}

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
    registerFontFaces(element.ownerDocument, drawn.fontFaces);
    const root = element.shadowRoot ?? element.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `${drawn.css}\n.wf-preview { width: ${DRAWN_WIDTH}px; transform: scale(${SCALE}); transform-origin: top left; }`;
    const page = document.createElement("div");
    page.className = `wf-preview ${drawn.pageClass}`;
    // daisyUI's theme colours are set for `:root` or `[data-theme]`; a shadow root has no `:root`.
    page.dataset.theme = drawn.theme;
    page.innerHTML = drawn.html;
    root.replaceChildren(style, page);
    // Scaling leaves the section's full height in the layout: the frame takes its scaled height,
    // and follows it (a font loading, an image's size arriving).
    const fit = () => {
      element.style.height = `${Math.min(page.offsetHeight * SCALE, PREVIEW.height)}px`;
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(page);
    return () => observer.disconnect();
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
    if (result.status === "failed") return undefined;
    const css = withCanvasFonts(result.css, source.baseUrl);
    return {
      html,
      css: css.replace(FONT_FACE, ""),
      // One per line: registerFontFaces keeps them a line each.
      fontFaces: (css.match(FONT_FACE) ?? []).map((face) => face.replace(/\s*\n\s*/g, " ")),
      pageClass: result.bodyClass
        .split(/\s+/)
        .filter((name) => name !== "" && !WHOLE_PAGE_CLASSES.has(name))
        .join(" "),
      theme: theme.preset,
    };
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
