import { type Theme, themeSchema } from "@webforge/model";
import { z } from "zod";
import {
  classNameSchema,
  type ItemHtmlRequest,
  itemHtmlRequestSchema,
  MAX_CLASS_CSS,
} from "../export-worker-protocol.js";

/** The classes the site uses and its theme: what the canvas styles are compiled from. */
const canvasCssRequestSchema = z.strictObject({
  theme: themeSchema,
  /** Class names found in the site's rendered pages, Header and Footer. */
  candidates: z.array(z.string().min(1).max(200)).max(20_000),
});

/** What the canvas styles are compiled from. */
export type CanvasCssRequest = z.infer<typeof canvasCssRequestSchema>;

/** The compiled site CSS for the canvas, or a failure (the canvas then keeps its last styles). */
const canvasCssResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("compiled"),
    /** Fonts are referenced as `url("webforge-font://fonts/<file>")`; see {@link CANVAS_FONT_URL}. */
    css: z.string(),
    /** Classes the exported pages put on `<body>`, for the canvas document's body. */
    bodyClass: z.string(),
  }),
  z.strictObject({ status: z.literal("failed") }),
]);

/** The compiled site CSS for the canvas. */
export type CanvasCssResult = z.infer<typeof canvasCssResultSchema>;

/**
 * Every class the site's styles support (#276): Tailwind's and daisyUI's, with the theme's colours,
 * and the variants that go before them (`md`, `hover`). A failure leaves the field without
 * suggestions; anything can still be typed.
 */
const classCatalogueResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("loaded"),
    classes: z.array(classNameSchema).max(100_000),
    variants: z.array(classNameSchema).max(1_000),
  }),
  z.strictObject({ status: z.literal("failed") }),
]);

/** Every class the site's styles support. */
export type ClassCatalogueResult = z.infer<typeof classCatalogueResultSchema>;

/** The CSS each class produces, in the order asked; `null` for a class that produces none. */
const classCssResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("css"),
    css: z.array(z.string().max(100_000).nullable()).max(MAX_CLASS_CSS),
  }),
  z.strictObject({ status: z.literal("failed") }),
]);

/** The CSS each class produces. */
export type ClassCssResult = z.infer<typeof classCssResultSchema>;

/**
 * An item's HTML as the export writes it (3.14): `""` for a hidden item, `null` when the page or the
 * item isn't there; or a failure.
 */
const itemHtmlResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("html"), html: z.string().max(1_000_000).nullable() }),
  z.strictObject({ status: z.literal("failed") }),
]);

/** An item's HTML as the export writes it. */
export type ItemHtmlResult = z.infer<typeof itemHtmlResultSchema>;

/**
 * Where compiled canvas CSS points for its fonts (2.2): the main process serves the installer's
 * font files through this scheme, as it serves Media images through `webforge-media:`.
 */
export const CANVAS_FONT_URL = "webforge-font://fonts/";

/** IPC channels of the `canvas` domain (`canvas:*`). */
export const canvasChannels = {
  /** Compiles the site's Tailwind and daisyUI CSS for the canvas, in a utility process (1.12). */
  compileCanvasCss: {
    channel: "canvas:compile-css",
    request: z.tuple([canvasCssRequestSchema]),
    response: canvasCssResultSchema,
  },
  /** Lists every class the site's styles support, for the CSS classes field (#276). */
  classCatalogue: {
    channel: "canvas:class-catalogue",
    request: z.tuple([themeSchema]),
    response: classCatalogueResultSchema,
  },
  /** The CSS some classes produce: previews in the class browser, and unknown-class warnings. */
  classCss: {
    channel: "canvas:class-css",
    request: z.tuple([themeSchema, z.array(classNameSchema).max(MAX_CLASS_CSS)]),
    response: classCssResultSchema,
  },
  /** An item of a page as the export writes it, for Advanced mode's CSS tab (3.14). */
  itemHtml: {
    channel: "canvas:item-html",
    request: z.tuple([itemHtmlRequestSchema]),
    response: itemHtmlResultSchema,
  },
} as const;

/** `window.webforge.canvas`. */
export interface CanvasApi {
  /** Compiles the site CSS the canvas shows the page with. */
  compileCss(request: CanvasCssRequest): Promise<CanvasCssResult>;
  /** Lists every class a site with `theme` supports. */
  classCatalogue(theme: Theme): Promise<ClassCatalogueResult>;
  /** The CSS each of `classes` produces with `theme` (at most 200 at once). */
  classCss(theme: Theme, classes: readonly string[]): Promise<ClassCssResult>;
  /** An item of a page as the export writes it. */
  itemHtml(request: ItemHtmlRequest): Promise<ItemHtmlResult>;
}
