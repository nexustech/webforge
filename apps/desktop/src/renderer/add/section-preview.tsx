import { t } from "@webforge/i18n";
import type { NodeDoc, SharedSectionId, Theme } from "@webforge/model";
import {
  type ComponentLibrary,
  EDITOR_RENDER_CONTEXT,
  renderNodesToHtml,
} from "@webforge/site-components";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AddItem } from "../editor/add-item.js";
import { type CompileCanvasCss, classesOfHtml } from "../editor/site-css.js";
import { reportFailure } from "../log.js";

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
export type PreviewSource = {
  readonly library: ComponentLibrary;
  /** The site's theme now, so a preview looks as the section will on this site. */
  readonly theme: () => Theme;
  /** The section a shared section stores, by its id, if the site has it. */
  readonly sharedSection: (id: SharedSectionId) => NodeDoc | undefined;
  readonly compileCss: CompileCanvasCss;
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

/** `node` as the export writes it, in `theme` with its kind's look, with the CSS its classes need. */
async function drawNode(
  source: Pick<PreviewSource, "library" | "compileCss">,
  node: NodeDoc,
  theme: Theme,
): Promise<Drawn | undefined> {
  // With the theme's look for its kind, as the canvas will draw it once added (3.12).
  const context =
    theme.looks === undefined
      ? EDITOR_RENDER_CONTEXT
      : { ...EDITOR_RENDER_CONTEXT, looks: theme.looks };
  const html = renderNodesToHtml([node], source.library, context);
  const result = await source.compileCss({
    theme,
    candidates: [...new Set(classesOfHtml(html))].sort(),
  });
  if (result.status === "failed") return undefined;
  const { css } = result;
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

/** What a preview draws: a component type, or a shared section by its id. */
type PreviewItem = Pick<AddItem, "type" | "sharedSectionId">;

/**
 * The Add panel's larger previews (F-ED-26, UX-10): a section, drawn with its defaults (or a
 * shared section as the site holds it) by the site library's static renderer, with the CSS its
 * classes need in the site's theme. Elements have none. Each is drawn once, and again only once
 * the theme or the shared section has changed.
 */
export function createSectionPreviews(source: PreviewSource): (item: AddItem) => ReactNode {
  return createPreviews(source, new Set(["section"]));
}

/**
 * Theme Studio's previews of each kind (3.12, CT-1): a section or an element of `type`, drawn with
 * its defaults in the site's theme, with the theme's look for its kind, as the Add panel's are.
 * Drawn again once the theme has changed, so a change to the look shows at once.
 */
export function createKindPreviews(
  source: Omit<PreviewSource, "sharedSection">,
): (type: string) => ReactNode {
  const previews = createPreviews(
    { ...source, sharedSection: () => undefined },
    new Set(["section", "element"]),
  );
  return (type) => previews({ type });
}

/** Previews of the library's components placed as `places`, and of shared sections. */
function createPreviews(
  source: PreviewSource,
  places: ReadonlySet<string>,
): (item: PreviewItem) => ReactNode {
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
  const nodeOf = (item: PreviewItem): NodeDoc | undefined => {
    if (item.sharedSectionId !== undefined) return source.sharedSection(item.sharedSectionId);
    const definition = source.library.components[item.type];
    // An element when its place is left out.
    if (definition === undefined || !places.has(definition.place ?? "element")) return undefined;
    let node = defaults.get(item.type);
    if (node === undefined) {
      node = { type: item.type, props: { ...structuredClone(definition.defaults), id: "preview" } };
      defaults.set(item.type, node);
    }
    return node;
  };
  const drawerFor = (item: PreviewItem) => {
    let drawer = drawers.get(item.type);
    if (drawer === undefined) {
      drawer = () => {
        const node = nodeOf(item);
        if (node === undefined) return Promise.resolve(undefined);
        const theme = source.theme();
        const kept = drawings.get(item.type);
        if (kept !== undefined && kept.node === node && kept.theme === theme) return kept.drawing;
        const drawing = drawNode(source, node, theme).catch((error: unknown) => {
          // No preview: the Add panel shows the section's name alone.
          reportFailure("add.preview", error);
          return undefined;
        });
        drawings.set(item.type, { node, theme, drawing });
        return drawing;
      };
      drawers.set(item.type, drawer);
    }
    return drawer;
  };
  return (item) => (nodeOf(item) === undefined ? null : <SectionPreview draw={drawerFor(item)} />);
}

/** The widths an item's preview draws it at, in CSS pixels: the canvas's Desktop and Mobile. */
const ITEM_WIDTHS = { desktop: 1280, mobile: 375 } as const;

/** A device an item's preview draws it for (3.13a). */
export type ItemDevice = keyof typeof ITEM_WIDTHS;

/** How wide each device's preview is on screen, and at most how tall. */
const ITEM_SHOWN = { desktop: { width: 400, height: 320 }, mobile: { width: 150, height: 320 } };

/**
 * `drawn` at `device`'s width, scaled into the preview's size, in a frame of its own: its media
 * queries see the device's width, as the canvas's do, so a value set for Mobile shows on Mobile.
 * The frame runs no scripts (an empty `sandbox` but for reading its height); the markup is the
 * site library's static HTML, as the export writes it.
 */
function ItemFrame({ drawn, device }: { readonly drawn: Drawn; readonly device: ItemDevice }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(0);
  const width = ITEM_WIDTHS[device];
  const shown = ITEM_SHOWN[device];
  const scale = shown.width / width;
  const page = [
    "<!doctype html>",
    `<html data-theme="${drawn.theme}"><head><meta charset="utf-8"><style>`,
    [...drawn.fontFaces, drawn.css, "body { margin: 0; }"].join("\n"),
    `</style></head><body class="${drawn.pageClass}">${drawn.html}</body></html>`,
  ].join("");
  // Its height once drawn, and again once its fonts have loaded.
  const measure = () => {
    const body = frame.current?.contentDocument?.body;
    if (body === undefined || body === null) return;
    setHeight(body.scrollHeight);
    void frame.current?.contentDocument?.fonts?.ready.then(() => setHeight(body.scrollHeight));
  };
  return (
    <div
      aria-hidden
      className="pointer-events-none overflow-hidden rounded-sm border border-border"
      style={{ width: shown.width, height: Math.min(height * scale, shown.height) || undefined }}
    >
      <iframe
        ref={frame}
        title={t(`device.${device}`)}
        tabIndex={-1}
        sandbox="allow-same-origin"
        srcDoc={page}
        onLoad={measure}
        style={{
          width,
          height: height || shown.height / scale,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
}

/** A preview of `node` drawn again whenever it changes, showing the last drawing meanwhile. */
function ItemPreview({
  source,
  node,
  device,
}: {
  readonly source: Omit<PreviewSource, "sharedSection">;
  readonly node: NodeDoc;
  readonly device: ItemDevice;
}) {
  const [drawn, setDrawn] = useState<Drawn | undefined>(undefined);
  useEffect(() => {
    let current = true;
    void drawNode(source, node, source.theme())
      .catch((error: unknown) => {
        reportFailure("style.preview", error);
        return undefined;
      })
      .then((result) => {
        if (current && result !== undefined) setDrawn(result);
      });
    return () => {
      current = false;
    };
  }, [source, node]);
  return drawn === undefined ? (
    <div aria-hidden style={{ width: ITEM_SHOWN[device].width, height: 80 }} />
  ) : (
    <ItemFrame drawn={drawn} device={device} />
  );
}

/**
 * *Style this ‹kind›…*'s previews (3.13a, CT-2): the item itself, as the person is styling it, on
 * Desktop or Mobile in the site's theme with its kind's look, drawn again as it changes.
 */
export function createItemPreviews(
  source: Omit<PreviewSource, "sharedSection">,
): (node: NodeDoc, device: ItemDevice) => ReactNode {
  return (node, device) => <ItemPreview source={source} node={node} device={device} />;
}
