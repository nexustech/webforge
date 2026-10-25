import { type ResolveFnOutput, type ResolveHookContext, registerHooks } from "node:module";

/**
 * Resolves `specifier` as Node does, but a relative `.js` import that isn't there as `.js` falls
 * back to the `.ts` file next to it: relative imports are written with `.js` extensions (repo
 * convention), and the sources are TypeScript.
 */
export function resolveTs(
  specifier: string,
  context: ResolveHookContext,
  nextResolve: (specifier: string, context?: ResolveHookContext) => ResolveFnOutput,
): ResolveFnOutput {
  if (specifier.startsWith(".") && specifier.endsWith(".js")) {
    try {
      return nextResolve(specifier, context);
    } catch {
      return nextResolve(`${specifier.slice(0, -3)}.ts`, context);
    }
  }
  return nextResolve(specifier, context);
}

// Lets plain Node run the repository's TypeScript sources in a child process or a worker thread
// that loads this module first (TYPESCRIPT_HOOK).
registerHooks({ resolve: resolveTs });
