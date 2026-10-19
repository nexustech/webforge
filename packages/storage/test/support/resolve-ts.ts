import { registerHooks } from "node:module";

// Lets plain Node run the package's TypeScript sources in a child process: relative imports are
// written with `.js` extensions (repo convention), so fall back to the `.ts` file next to them.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && specifier.endsWith(".js")) {
      try {
        return nextResolve(specifier, context);
      } catch {
        return nextResolve(`${specifier.slice(0, -3)}.ts`, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
