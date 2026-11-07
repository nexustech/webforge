// Bundles the bridge (ADR 0021) into one file with esbuild: the server of Webforge's Claude Desktop
// extension, run on Claude Desktop's own Node.js. The desktop app's build calls this, and puts the
// file beside app.asar.

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

/** The Node.js the bridge needs at least: Claude Desktop ships a newer one. */
export const BRIDGE_NODE = "node20";

/**
 * Writes the bundled bridge to `outfile`, an ES module that needs nothing but Node.js. Gives the
 * files it holds, by their full paths, for the app's third-party notices (5.3).
 */
export async function buildBridge(outfile: string): Promise<readonly string[]> {
  const built = await build({
    entryPoints: [fileURLToPath(new URL("./main.ts", import.meta.url))],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: BRIDGE_NODE,
    // Readable, as the exported sites are: anyone can see what runs in Claude Desktop.
    minify: false,
    legalComments: "inline",
    logLevel: "warning",
    metafile: true,
  });
  // esbuild names them from the working directory.
  return Object.keys(built.metafile.inputs).map((input) => resolve(input));
}
