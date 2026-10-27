// Package boundaries from engineering standards §3 and architecture §4.
// Run with `pnpm deps`. Paths are relative to the repository root.

/** Packages that hold core logic and stay framework-free. */
const CORE = "^packages/(errors|model|history|storage|pipeline|publish|commands)/";

/** Code that runs in a renderer (or must render without Node): no Node built-ins, no Electron. */
const RENDERER_SAFE = [
  "^apps/desktop/src/(renderer|shared)/",
  "^packages/(model|history|engine|site-components|themes|editor-ui|i18n|commands)/",
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
      // Vite-only suffixes (?raw, ?base64) on a package's exported file can't be resolved here, nor
      // a Vite plugin's virtual module (the site components' theme stylesheets, 2.13).
      to: { couldNotResolve: true, pathNot: "\\?(raw|base64)$|^virtual:webforge-" },
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
        "errors, model, history, storage, pipeline, publish and commands are framework-free (standards §3).",
      from: { path: CORE },
      to: { path: [REACT, ELECTRON] },
    },
    {
      name: "renderer-no-node",
      severity: "error",
      comment:
        "Renderer code never imports Node built-ins or Electron; it uses the typed window.webforge API.",
      // Storybook's own config runs in Node: it writes the theme stories' stylesheets (2.13).
      from: {
        path: RENDERER_SAFE,
        pathNot: "^packages/site-components/\\.storybook/(main|theme-gallery)\\.ts$",
      },
      to: { dependencyTypes: ["core"] },
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
      name: "renderer-no-node-packages",
      severity: "error",
      comment:
        "Renderer code never imports the packages that run in the main process or a worker: the pipeline, storage and publishing (R16).",
      from: { path: RENDERER_SAFE },
      to: { path: "^packages/(pipeline|storage|publish)/" },
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
          // Declared subpath export: @webforge/themes/font-plan (zod only: no font catalogue, so
          // the preload and the catalogue build under plain Node can take it).
          "^packages/themes/src/fonts/plan\\.ts$",
          // Declared subpath export: @webforge/templates/node (reads the template folders).
          "^packages/templates/src/node\\.ts$",
          // Declared subpath export: @webforge/test-utils/renderer (the renderer's test kit, B6).
          "^packages/test-utils/src/renderer\\.ts$",
          // Declared subpath export: @webforge/test-utils/vitest (scaled timeouts, ADR 0014): Vitest
          // only, so Playwright's e2e, which imports the root entry, never loads Vitest (#539).
          "^packages/test-utils/src/timeouts\\.ts$",
          // Declared subpath export: @webforge/site-components/catalogue-data (the catalogue as
          // plain data, without React, for the command layer, 4.8).
          "^packages/site-components/src/catalogue-data\\.(ts|json)$",
        ],
      },
    },
    {
      name: "commands-only-catalogue-data",
      severity: "error",
      comment:
        "packages/commands reads the catalogue as plain data, never the components, the canvas engine or the editor (architecture §4, 4.8).",
      from: { path: "^packages/commands/" },
      to: {
        path: [
          "^packages/(site-components|engine|editor-ui|storage|pipeline|publish)/",
          "(^|/)node_modules/@puckeditor/",
        ],
        pathNot: "^packages/site-components/src/catalogue-data\\.(ts|json)$",
      },
    },
    {
      name: "catalogue-data-no-react",
      severity: "error",
      comment:
        "The catalogue as data, and the rich-text cleaning it offers, load without React or the " +
        "components (4.8).",
      from: {
        path: "^packages/site-components/src/(catalogue-data|rich-text-html|document-path)\\.ts$",
      },
      to: {
        path: [REACT, "^packages/site-components/src/"],
        pathNot:
          "^packages/site-components/src/(catalogue-data\\.(ts|json)|rich-text-html\\.ts|document-path\\.ts)$",
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
        "what it offers the others. shell/ and editor/ are what every area builds on, and " +
        "testing/ what every area's tests and stories use. " +
        "tools/src/check-area-cycles.ts checks there are no cycles between areas.",
      from: {
        path: "^apps/desktop/src/renderer/([^/]+)/",
        pathNot: "^apps/desktop/src/renderer/(shell|editor|testing)/",
      },
      to: {
        path: "^apps/desktop/src/renderer/[^/]+/",
        pathNot: [
          "^apps/desktop/src/renderer/(shell|editor|testing|$1)/",
          "^apps/desktop/src/renderer/[^/]+/index\\.ts$",
        ],
      },
    },
    {
      name: "renderer-editor-areas-through-index",
      severity: "error",
      comment:
        "editor/ (what every area builds on) uses an area only through that area's index.ts " +
        "(2.20, B8), as the areas use each other. Editor.tsx, which draws the editor's dialogs " +
        "and menus from the areas, is the exception, as the composition root's other half.",
      from: {
        path: "^apps/desktop/src/renderer/editor/",
        pathNot: "^apps/desktop/src/renderer/editor/Editor\\.tsx$",
      },
      to: {
        path: "^apps/desktop/src/renderer/[^/]+/",
        pathNot: [
          "^apps/desktop/src/renderer/(shell|editor|testing)/",
          "^apps/desktop/src/renderer/[^/]+/index\\.ts$",
        ],
      },
    },
    {
      name: "renderer-testing-only-in-tests",
      severity: "error",
      comment:
        "renderer/testing/ (B6) holds fixtures and story helpers for tests and stories only, so " +
        "none of it reaches the app or its bundle.",
      from: {
        pathNot: ["\\.test\\.tsx?$", "\\.stories\\.tsx$", "^apps/desktop/src/renderer/testing/"],
      },
      to: { path: "^apps/desktop/src/renderer/testing/" },
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
