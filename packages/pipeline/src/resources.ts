import type { CatalogueFont, FontFace } from "@webforge/themes";
import type {} from "./codec-globals.js";

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
  /**
   * The bytes of a font file a site uses (2.2, `fontFacesFor` in `@webforge/themes`), or
   * `undefined` if there are none. The pipeline checks them against the catalogue's SHA-256.
   */
  readonly readFont: (face: FontFace) => Promise<Uint8Array<ArrayBuffer> | undefined>;
  /**
   * The font families there are files for: the catalogue's when left out. The app adds the ones
   * downloaded on this computer (2.2), so a site set in one gets its files.
   */
  readonly fonts?: readonly CatalogueFont[];
  /** WebAssembly modules of the image codecs (jSquash). */
  readonly codecs: CodecModules;
  /**
   * The bytes and type the open site stores under a SHA-256, for images and documents the
   * snapshot names by `hash` instead of carrying (R15); `undefined` if the site has none. Read one
   * at a time, as the build reaches each.
   */
  readonly readMedia?: (hash: string) => Promise<StoredMedia | undefined>;
  /** Where the encoded images of earlier builds are kept, so an unchanged image isn't encoded again. */
  readonly imageCache?: ImageCache;
};

/** An image's or document's stored bytes, with the type they were stored as. */
export type StoredMedia = { readonly data: Uint8Array; readonly mime: string };

/**
 * Encoded images by key (R15): the pipeline names each one by its original's SHA-256, its crop,
 * its width, its format and the encoder's settings, so a key never stands for other bytes. What
 * keeps them, and how many, is the caller's: the app's export worker keeps them in memory while the
 * site is open, never on disk ({@link createMemoryImageCache}).
 */
export type ImageCache = {
  get(key: string): Promise<Uint8Array | undefined>;
  set(key: string, data: Uint8Array): Promise<void>;
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
