import { registerHooks } from "node:module";

// Lets a script run the desktop app's TypeScript as it is (`node --experimental-transform-types
// --import ./tools/src/ts-imports.ts <script>`): its relative imports name the built `.js` file,
// which is found as the `.ts` beside it, as the bundler finds it. Only for a relative import that
// isn't there as written.

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (!specifier.startsWith(".") || !specifier.endsWith(".js")) throw error;
      return next(`${specifier.slice(0, -".js".length)}.ts`, context);
    }
  },
});
