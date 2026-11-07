// Bundles the bridge (ADR 0021) into one file with esbuild: the server of Webforge's Claude Desktop
// extension, run on Claude Desktop's own Node.js. The desktop app's build calls this, and puts the
// file beside app.asar.

import { fileURLToPath } from "node:url";
import { build } from "esbuild";

/** The Node.js the bridge needs at least: Claude Desktop ships a newer one. */
export const BRIDGE_NODE = "node20";

/** Writes the bundled bridge to `outfile`, an ES module that needs nothing but Node.js. */
export async function buildBridge(outfile: string): Promise<void> {
  await build({
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
  });
}
