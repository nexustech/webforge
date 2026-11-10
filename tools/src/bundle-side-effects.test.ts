import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  moduleSideEffects,
  SIDE_EFFECT_MODULES,
  sideEffectImports,
} from "./bundle-side-effects.js";

const repo = resolve(import.meta.dirname, "../..");

/** Every TypeScript module the app is built from, leaving out tests and stories. */
function sources(): string[] {
  const roots = [
    join(repo, "apps/desktop/src"),
    ...readdirSync(join(repo, "packages")).map((name) => join(repo, "packages", name, "src")),
  ];
  return roots
    .filter((root) => existsSync(root))
    .flatMap((root) =>
      readdirSync(root, { recursive: true, encoding: "utf8" }).map((file) => join(root, file)),
    )
    .filter((file) => /\.tsx?$/.test(file) && !/\.(test|stories)\.tsx?$|\.d\.ts$/.test(file));
}

describe("the renderer's modules with side effects (#896)", () => {
  it("lets the bundler leave out Webforge's own modules, except those that act when loaded", () => {
    for (const id of [
      `${repo}/apps/desktop/src/renderer/site/PagesPanel.tsx`,
      `${repo}\\packages\\engine\\src\\index.ts`,
      "/build/packages/editor-ui/src/components/button.tsx",
    ]) {
      expect(moduleSideEffects(id), id).toBe(false);
    }
    expect(moduleSideEffects(`${repo}/apps/desktop/src/renderer/shell/form-messages.ts`)).toBe(
      true,
    );
    expect(
      moduleSideEffects(`${repo}\\apps\\desktop\\src\\renderer\\shell\\form-messages.ts`),
    ).toBe(true);
  });

  it("leaves dependencies, stylesheets and virtual modules to their package.json", () => {
    for (const id of [
      `${repo}/node_modules/.pnpm/react@19.3.1/node_modules/react/index.js`,
      `${repo}/node_modules/.pnpm/x@1.0.0/node_modules/x/packages/y/src/index.ts`,
      `${repo}/apps/desktop/src/renderer/styles.css`,
      `${repo}/packages/engine/src/puck/puck-engine.tsx?inline`,
      "\0vite/preload-helper.js",
      `${repo}/docs/help/site-check.md?raw`,
    ]) {
      expect(moduleSideEffects(id), id).toBeUndefined();
    }
  });

  it("finds the imports made only to load a module", () => {
    expect(
      sideEffectImports(
        [
          'import "./styles.css";',
          "import './shell/form-messages.js'",
          'import { t } from "@webforge/i18n";',
          'import type { X } from "./x.js";',
          'const later = import("./later.js");',
        ].join("\n"),
      ),
    ).toEqual(["./styles.css", "./shell/form-messages.js"]);
  });

  it("lists every module of Webforge's own imported only to load it", () => {
    const listed = new Set(SIDE_EFFECT_MODULES);
    const unlisted: string[] = [];
    for (const file of sources()) {
      for (const specifier of sideEffectImports(readFileSync(file, "utf8"))) {
        if (specifier.startsWith("@webforge/")) {
          unlisted.push(`${relative(repo, file)}: ${specifier}`);
          continue;
        }
        if (!specifier.startsWith(".") || !/\.jsx?$/.test(specifier)) continue;
        const target = resolve(dirname(file), specifier.replace(/\.jsx?$/, ""));
        const module = [".ts", ".tsx"].map((ending) => target + ending).find(existsSync);
        const path = relative(repo, module ?? target).replaceAll("\\", "/");
        if (!listed.has(path)) unlisted.push(`${relative(repo, file)}: ${specifier}`);
      }
    }
    expect(unlisted).toEqual([]);
  });

  it("lists only modules that exist", () => {
    for (const module of SIDE_EFFECT_MODULES)
      expect(existsSync(join(repo, module)), module).toBe(true);
  });
});
