import { type MinifyOptions, type MinifyOutput, minify } from "terser";

// Apart from site-code.ts, whose site-code helpers the main process uses (`./light`, #892):
// Terser is 0.8 MB that only the export worker needs.

/**
 * Where `custom.js` has a mistake that stops browsers running it, by its line, or nothing when it
 * reads as a classic script (3.9). It is exported as written either way: a browser reports the same
 * mistake. An `import` or `export` is one, as the script isn't a module (X1).
 */
export async function scriptMistake(script: string): Promise<number | undefined> {
  let ast: unknown;
  try {
    ({ ast } = (await minify(script, READ_ONLY)) as MinifyOutput & { readonly ast?: unknown });
  } catch (error) {
    const line = (error as { line?: unknown }).line;
    return typeof line === "number" ? line : 1;
  }
  // Terser reads `import` and `export` in a script too; a browser doesn't.
  const body = (ast as { body?: readonly TopLevel[] } | undefined)?.body ?? [];
  return body.find((statement) => MODULE_ONLY.has(statement.TYPE))?.start.line;
}

/**
 * Terser's options to read a classic script and give its syntax tree, unchanged. `format.ast` is
 * in Terser's documentation but not its types.
 */
const READ_ONLY = {
  compress: false,
  mangle: false,
  module: false,
  format: { ast: true, code: false },
} as MinifyOptions;

/** A top-level statement as Terser's syntax tree has it: its kind, and where it starts. */
type TopLevel = { readonly TYPE: string; readonly start: { readonly line: number } };

/** Statements only a module can have. */
const MODULE_ONLY = new Set(["Import", "Export"]);
