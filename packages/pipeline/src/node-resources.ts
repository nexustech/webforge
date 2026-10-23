import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { compileCodecs, type PipelineResources, TAILWIND_STYLESHEETS } from "./resources.js";

const require = createRequire(import.meta.url);

async function bytes(specifier: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await readFile(require.resolve(specifier)));
}

/**
 * Loads the pipeline's resources from `node_modules`: for tests and Node scripts. The packaged app
 * bundles the same files into its build worker instead.
 */
export async function loadNodeResources(): Promise<PipelineResources> {
  const stylesheets = Object.fromEntries(
    await Promise.all(
      TAILWIND_STYLESHEETS.map(async (id) => [id, await readFile(require.resolve(id), "utf8")]),
    ),
  );
  const codecs = await compileCodecs({
    jpegDecode: await bytes("@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm"),
    jpegEncode: await bytes("@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm"),
    png: await bytes("@jsquash/png/codec/pkg/squoosh_png_bg.wasm"),
    webpEncode: await bytes("@jsquash/webp/codec/enc/webp_enc_simd.wasm"),
    resize: await bytes("@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm"),
  });
  const daisyui: unknown = (await import("daisyui")).default;
  const daisyuiTheme: unknown = (await import("daisyui/theme")).default;
  // The catalogue's font files, from the packages this package depends on, at their versions.
  const readFont: PipelineResources["readFont"] = async (face) => {
    try {
      return new Uint8Array(await readFile(require.resolve(`${face.package}/files/${face.file}`)));
    } catch {
      return undefined;
    }
  };
  return { stylesheets, daisyui, daisyuiTheme, readFont, codecs };
}
