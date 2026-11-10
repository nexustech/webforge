// Which of Webforge's own modules the renderer's bundle keeps for their side effects alone (#896).
//
// The bundler keeps a module that is imported, even when nothing it exports is used, unless it
// knows loading it does nothing else. Areas use one another only through their index.ts (B2), so a
// start screen taking one function from an area's index would otherwise bring the whole area, and
// with it the editor, its site components and Puck. Webforge's own modules (`apps/desktop/src`,
// `packages/*/src`) do nothing when loaded but declare what they export, except those listed
// here; the test checks every import made only to load a module (`import "./x.js";`) is one of
// them. A dependency's own `package.json` says for its modules, as before.
//
// This file has no relative imports so Node can run it directly with type stripping.

/** Webforge's own modules that do something when loaded: kept even when none of their exports is. */
export const SIDE_EFFECT_MODULES: readonly string[] = [
  // Words zod's problems in the editor's words (2.21), for every schema.
  "apps/desktop/src/renderer/shell/form-messages.ts",
];

/** A TypeScript module of Webforge's own: the desktop app's or a workspace package's source. */
const OWN_SOURCE = /(?:^|\/)(?:apps\/desktop|packages\/[^/]+)\/src\/[^?]*\.tsx?$/;

/**
 * Rolldown's `treeshake.moduleSideEffects` for the renderer: `false` for Webforge's own modules,
 * which it may then leave out when nothing they export is used, except {@link SIDE_EFFECT_MODULES};
 * `undefined`, which leaves it to the module's `package.json`, for anything else (dependencies,
 * stylesheets, virtual modules).
 */
export function moduleSideEffects(id: string): boolean | undefined {
  const path = id.replaceAll("\\", "/");
  if (path.includes("/node_modules/") || !OWN_SOURCE.test(path)) return undefined;
  return SIDE_EFFECT_MODULES.some((module) => path.endsWith(`/${module}`));
}

/** What `source` imports only to load it (`import "./x.js";`), as written. */
export function sideEffectImports(source: string): string[] {
  return [...source.matchAll(/^\s*import\s*["']([^"']+)["']\s*;?\s*$/gm)].flatMap(
    ([, specifier]) => (specifier === undefined ? [] : [specifier]),
  );
}
