import { themeSchema } from "@webforge/model";
import { z } from "zod";

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
} as const;

/** `window.webforge.canvas`. */
export interface CanvasApi {
  /** Compiles the site CSS the canvas shows the page with. */
  compileCss(request: CanvasCssRequest): Promise<CanvasCssResult>;
}
