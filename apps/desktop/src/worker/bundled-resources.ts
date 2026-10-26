import { Buffer } from "node:buffer";
import jpegDecode from "@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm?base64";
import jpegEncode from "@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?base64";
import png from "@jsquash/png/codec/pkg/squoosh_png_bg.wasm?base64";
import resize from "@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm?base64";
import webpEncode from "@jsquash/webp/codec/enc/webp_enc_simd.wasm?base64";
import {
  compileCodecs,
  onceUntilFailure,
  type PipelineResources,
  type StyleResources,
} from "@webforge/pipeline";
import daisyui from "daisyui";
import daisyuiTheme from "daisyui/theme";
import preflight from "tailwindcss/preflight.css?raw";
import theme from "tailwindcss/theme.css?raw";
import utilities from "tailwindcss/utilities.css?raw";

// Every file the pipeline needs is bundled into the worker: CSS as text, binaries as base64
// strings (the ?base64 plugin in electron.vite.config.ts), except a site's fonts, which the main
// process sends with an export (2.2). Nothing is resolved from node_modules or read from app.asar
// at run time.

function bytesOf(base64: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

let styles: StyleResources | null = null;

/** What compiling CSS needs: stylesheets and daisyUI, loaded once per worker. */
export function loadStyleResources(): StyleResources {
  styles ??= {
    stylesheets: {
      "tailwindcss/theme.css": theme,
      "tailwindcss/preflight.css": preflight,
      "tailwindcss/utilities.css": utilities,
    },
    daisyui,
    daisyuiTheme,
  };
  return styles;
}

/**
 * The pipeline's resources, decoded and compiled once per worker. The image codecs are compiled
 * only here, so a worker that only compiles canvas CSS never pays for them. A failed load isn't
 * kept: the long-lived workers try again with their next job (R15).
 */
export const loadBundledResources: () => Promise<PipelineResources> = onceUntilFailure(async () => {
  const codecs = await compileCodecs({
    jpegDecode: bytesOf(jpegDecode),
    jpegEncode: bytesOf(jpegEncode),
    png: bytesOf(png),
    webpEncode: bytesOf(webpEncode),
    resize: bytesOf(resize),
  });
  // An export's fonts come with its job (`runExport`); no other job needs any.
  return { ...loadStyleResources(), codecs, readFont: async () => undefined };
});
