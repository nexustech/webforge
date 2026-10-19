import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import {
  compileCodecs,
  type FontFile,
  type PipelineResources,
  TAILWIND_STYLESHEETS,
} from "./resources.js";

const require = createRequire(import.meta.url);

const FONT_WEIGHTS = [400, 700] as const;

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
  const fonts: FontFile[] = await Promise.all(
    FONT_WEIGHTS.map(async (weight) => {
      const fileName = `inter-latin-${weight}-normal.woff2`;
      const data = await readFile(require.resolve(`@fontsource/inter/files/${fileName}`));
      return { family: "Inter", weight, fileName, data: new Uint8Array(data) };
    }),
  );
  const codecs = await compileCodecs({
    jpegDecode: await bytes("@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm"),
    jpegEncode: await bytes("@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm"),
    png: await bytes("@jsquash/png/codec/pkg/squoosh_png_bg.wasm"),
    webpEncode: await bytes("@jsquash/webp/codec/enc/webp_enc_simd.wasm"),
    resize: await bytes("@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm"),
  });
  const daisyui: unknown = (await import("daisyui")).default;
  return { stylesheets, daisyui, fonts, codecs };
}
