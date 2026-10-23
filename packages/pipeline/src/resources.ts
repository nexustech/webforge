/**
 * Everything file-based the pipeline needs, passed in by whoever runs it. The pipeline itself never
 * resolves files: under Vitest and in Node scripts they come from `node_modules`
 * (`loadNodeResources`), and in the packaged app the build worker bundles them, so nothing depends
 * on resolving packages from inside `app.asar`.
 */
export type PipelineResources = {
  /** Tailwind's stylesheets by import id: `tailwindcss/theme.css`, `…/preflight.css`, `…/utilities.css`. */
  readonly stylesheets: Readonly<Record<string, string>>;
  /** The daisyUI Tailwind plugin (the default export of `daisyui`). */
  readonly daisyui: unknown;
  /** daisyUI's custom-theme plugin (the default export of `daisyui/theme`), for the site's theme. */
  readonly daisyuiTheme: unknown;
  /** Font files to copy into `assets/fonts/`, with the `@font-face` rules that use them. */
  readonly fonts: readonly FontFile[];
  /** WebAssembly modules of the image codecs (jSquash). */
  readonly codecs: CodecModules;
};

/** One woff2 file of a font family. */
export type FontFile = {
  /** The CSS font family, e.g. `Inter`. */
  readonly family: string;
  readonly weight: number;
  /** File name in `assets/fonts/`, e.g. `inter-latin-400-normal.woff2`. */
  readonly fileName: string;
  readonly data: Uint8Array;
};

/** Compiled WebAssembly modules for decoding, resizing and encoding images. */
export type CodecModules = {
  readonly jpegDecode: WebAssembly.Module;
  readonly jpegEncode: WebAssembly.Module;
  /** Decodes and encodes PNG. */
  readonly png: WebAssembly.Module;
  readonly webpEncode: WebAssembly.Module;
  readonly resize: WebAssembly.Module;
};

/** The Tailwind stylesheet import ids the pipeline asks for. */
export const TAILWIND_STYLESHEETS = [
  "tailwindcss/theme.css",
  "tailwindcss/preflight.css",
  "tailwindcss/utilities.css",
] as const;

/** The raw `.wasm` files of the image codecs, by {@link CodecModules} key. */
export type CodecBytes = { readonly [K in keyof CodecModules]: Uint8Array<ArrayBuffer> };

/** Compiles the image codecs' WebAssembly once; pass the result in {@link PipelineResources}. */
export async function compileCodecs(bytes: CodecBytes): Promise<CodecModules> {
  return {
    jpegDecode: await WebAssembly.compile(bytes.jpegDecode),
    jpegEncode: await WebAssembly.compile(bytes.jpegEncode),
    png: await WebAssembly.compile(bytes.png),
    webpEncode: await WebAssembly.compile(bytes.webpEncode),
    resize: await WebAssembly.compile(bytes.resize),
  };
}
