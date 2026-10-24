// Package boundaries from engineering standards §3 and architecture §4.
// Run with `pnpm deps`. Paths are relative to the repository root.

/** Packages that hold core logic and stay framework-free. */
const CORE = "^packages/(errors|model|history|storage|pipeline|publish)/";

/** Code that runs in a renderer (or must render without Node): no Node built-ins, no Electron. */
const RENDERER_SAFE = [
  "^apps/desktop/src/(renderer|shared)/",
  "^packages/(model|history|engine|site-components|themes|editor-ui|i18n)/",
];

const REACT = "^(react|react-dom)(/|$)|(^|/)node_modules/(react|react-dom)/";
const ELECTRON = "^electron(/|$)|(^|/)node_modules/electron/";

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular imports make modules hard to reason about and to test in isolation.",
      from: {},
      to: { circular: true },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      comment: "Every import must resolve to a file or an installed package.",
      from: {},
      // Vite-only suffixes (?raw, ?base64) on a package's exported file can't be resolved here.
      to: { couldNotResolve: true, pathNot: "\\?(raw|base64)$" },
    },
    {
      name: "no-non-package-json",
      severity: "error",
      comment: "Import only packages declared in the importing workspace's package.json.",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
    {
      name: "core-no-react-or-electron",
      severity: "error",
      comment:
        "errors, model, history, storage, pipeline and publish are framework-free (standards §3).",
      from: { path: CORE },
      to: { path: [REACT, ELECTRON] },
    },
    {
      name: "renderer-no-node",
      severity: "error",
      comment:
        "Renderer code never imports Node built-ins or Electron; it uses the typed window.webforge API.",
      from: { path: RENDERER_SAFE },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "pipeline-navigation-no-node",
      severity: "error",
      comment:
        "@webforge/pipeline/navigation runs in the renderer (the canvas's Header): no Node built-ins.",
      from: { path: "^packages/pipeline/src/(navigation|links).ts$" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "pipeline-navigation-self-contained",
      severity: "error",
      comment:
        "@webforge/pipeline/navigation imports no other pipeline module, which may use Node.",
      from: { path: "^packages/pipeline/src/(navigation|links).ts$" },
      to: {
        path: "^packages/pipeline/src/",
        pathNot: "^packages/pipeline/src/(navigation|links).ts$",
      },
    },
    {
      name: "renderer-no-electron",
      severity: "error",
      comment:
        "Renderer code never imports Node built-ins or Electron; it uses the typed window.webforge API.",
      from: { path: RENDERER_SAFE },
      to: { path: ELECTRON },
    },
    {
      name: "main-no-react",
      severity: "error",
      comment: "Main-process and preload code never imports React.",
      from: { path: "^apps/desktop/src/(main|preload)/" },
      to: { path: REACT },
    },
    {
      name: "no-electron-remote",
      severity: "error",
      comment: "@electron/remote is banned; use the typed preload API.",
      from: {},
      to: { path: "(^|/)node_modules/@electron/remote/" },
    },
    {
      name: "only-engine-imports-puck",
      severity: "error",
      comment: "Puck stays behind the CanvasEngine adapter in packages/engine (C6).",
      from: { pathNot: "^packages/engine/" },
      to: { path: "(^|/)node_modules/(@measured/puck|@puckeditor/[^/]+)/" },
    },
    {
      name: "only-editor-ui-imports-shadcn",
      severity: "error",
      comment: "Only editor-ui and the desktop renderer use shadcn/ui (Radix primitives).",
      from: { pathNot: "^(packages/editor-ui|apps/desktop/src/renderer)/" },
      to: { path: "(^|/)node_modules/(radix-ui|@radix-ui/[^/]+)/" },
    },
    {
      name: "site-components-no-editor",
      severity: "error",
      comment: "Site components render exported sites and must not depend on editor code.",
      from: { path: "^packages/site-components/" },
      to: { path: ["^packages/(engine|editor-ui|history|storage|pipeline|publish)/", "^apps/"] },
    },
    {
      name: "packages-not-to-apps",
      severity: "error",
      comment: "Packages are reusable; they never import from an app.",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "no-deep-package-imports",
      severity: "error",
      comment: "Import another package only through its entry point (@webforge/<name>).",
      from: { path: "^(apps|packages)/([^/]+)/" },
      to: {
        path: "^packages/",
        pathNot: [
          "^packages/$2/",
          "^packages/[^/]+/src/index\\.tsx?$",
          // Declared subpath export: @webforge/pipeline/node (the Node-only resource loader).
          "^packages/pipeline/src/node-resources\\.ts$",
          // Declared subpath export: @webforge/pipeline/navigation (no Node; the canvas uses it).
          "^packages/pipeline/src/navigation\\.ts$",
          // Declared subpath export: @webforge/themes/font-plan (zod only: no font catalogue, so
          // the preload and the catalogue build under plain Node can take it).
          "^packages/themes/src/fonts/plan\\.ts$",
        ],
      },
    },
    {
      name: "test-utils-only-in-tests",
      severity: "error",
      comment: "test-utils holds fixtures and helpers for tests only.",
      from: { pathNot: ["\\.test\\.tsx?$", "^packages/test-utils/", "^e2e/"] },
      to: { path: "^packages/test-utils/" },
    },
    {
      name: "renderer-areas-through-index",
      severity: "error",
      comment:
        "A renderer area (renderer/<area>/) uses another only through that area's index.ts (B2): " +
        "what it offers the others. shell/ and editor/ are what every area builds on. " +
        "tools/src/check-area-cycles.ts checks there are no cycles between areas.",
      from: {
        path: "^apps/desktop/src/renderer/([^/]+)/",
        pathNot: "^apps/desktop/src/renderer/(shell|editor)/",
      },
      to: {
        path: "^apps/desktop/src/renderer/[^/]+/",
        pathNot: [
          "^apps/desktop/src/renderer/(shell|editor|$1)/",
          "^apps/desktop/src/renderer/[^/]+/index\\.ts$",
        ],
      },
    },
    {
      name: "no-orphans",
      severity: "warn",
      comment: "A module nothing imports is probably dead code (knip checks this too).",
      from: {
        orphan: true,
        // webforge.js behaviours are loaded by import.meta.glob (behaviours.ts), which the cruiser
        // doesn't see as an import.
        pathNot: [
          "\\.d\\.ts$",
          "(^|/)[^/]+\\.config\\.ts$",
          "\\.test\\.tsx?$",
          "^packages/site-components/src/behaviours/[^/]+\\.js$",
        ],
      },
      to: {},
    },
  ],
  options: {
    // TypeScript 7 ships no JavaScript compiler API, so parse with swc instead of tsc.
    parser: "swc",
    doNotFollow: { path: "(^|/)node_modules/" },
    // Only our own build output. Excluding node_modules here would drop npm imports from the graph
    // and silently disable the rules above; doNotFollow already stops traversal into it.
    exclude: {
      path: [
        "^(apps|packages)/[^/]+/(out|dist|release|coverage|storybook-static)/",
        "/test/golden/",
        // Read as data by the UI-string guard's tests, never imported.
        "^tools/test/fixtures/",
      ],
    },
    combinedDependencies: false,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types"],
      // dependency-cruiser itself resolves "./foo.js" imports to foo.ts, as TypeScript does.
      extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".d.ts"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
