// The two browser globals the image codecs (jSquash) use, declared here instead of the whole
// "dom" lib (R16), so a `document` or `window` in pipeline code is a type error. Node has
// WebAssembly; images.ts installs a stand-in ImageData before the codecs run.

declare global {
  /** Pixels in RGBA order, as jSquash's codecs take and give them. */
  interface ImageData {
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;
    readonly colorSpace: string;
  }

  var ImageData: {
    prototype: ImageData;
    new (data: Uint8ClampedArray, width: number, height?: number): ImageData;
  };

  namespace WebAssembly {
    /** A compiled module, to instantiate once per codec. */
    interface Module {}
    function compile(bytes: Uint8Array<ArrayBuffer>): Promise<Module>;
  }
}

// A module (the package is ESM), so the declarations above are global only through
// `declare global`; images.ts and resources.ts import it, by type only.
export {};
