import { createHash, randomBytes } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { buildBridge } from "@webforge/mcp-bridge/build";
import { moduleSideEffects } from "@webforge/tools/bundle-side-effects";
import {
  collectNotices,
  dependencyDirs,
  findPackageDir,
  packageDirOf,
  writeNotices,
} from "@webforge/tools/third-party-notices";
import { defineConfig } from "electron-vite";
import { type Plugin, runnerImport } from "vite";
import {
  buildContentSecurityPolicy,
  type ContentSecurityPolicyPage,
} from "./src/shared/content-security-policy.js";

const CSP_PLACEHOLDER = 'content="%WEBFORGE_CSP%"';

/** Each HTML page of the renderer, by file name, and whose policy it gets (S35). */
const CSP_PAGES: Readonly<Record<string, ContentSecurityPolicyPage>> = {
  "index.html": "editor",
  "help.html": "help",
};

/**
 * Fills the Content-Security-Policy meta tag of each renderer page with that page's policy; fails
 * the build if the tag is missing, or if a page isn't in {@link CSP_PAGES}, so a new page chooses.
 */
function contentSecurityPolicy(devNonce: string | undefined): Plugin {
  return {
    name: "webforge:content-security-policy",
    transformIndexHtml: (html, context) => {
      const file = context.filename.replaceAll("\\", "/").split("/").at(-1) ?? "";
      const page = Object.hasOwn(CSP_PAGES, file) ? CSP_PAGES[file] : undefined;
      if (page === undefined) {
        throw new Error(`${file} needs a Content Security Policy: add it to CSP_PAGES`);
      }
      if (!html.includes(CSP_PLACEHOLDER)) {
        throw new Error(`${file} must contain a CSP meta tag with ${CSP_PLACEHOLDER}`);
      }
      const csp = buildContentSecurityPolicy(
        devNonce === undefined ? { page } : { page, devNonce },
      );
      return html.replace(CSP_PLACEHOLDER, `content="${csp}"`);
    },
  };
}

/**
 * Fills in the words of index.html's start-up screen (#887), drawn before the editor's scripts and
 * its i18n have loaded, from i18n, escaped for HTML; fails the build on a placeholder it doesn't
 * know. i18n is TypeScript importing `./x.js`, which Node can't load as it loads this file: Vite's
 * module runner can, once per build.
 */
function startupScreen(): Plugin {
  let words: Promise<Readonly<Record<string, string>>> | undefined;
  const loadWords = async () => {
    const { module } = await runnerImport<typeof import("@webforge/i18n")>("@webforge/i18n", {
      configFile: false,
      logLevel: "warn",
    });
    return {
      "%WEBFORGE_APP_NAME%": module.t("app.name"),
      "%WEBFORGE_STARTING%": module.t("app.starting"),
    };
  };
  const escapeHtml = (text: string) =>
    text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  return {
    name: "webforge:startup-screen",
    transformIndexHtml: async (html) => {
      words ??= loadWords();
      const filled = Object.entries(await words).reduce(
        (page, [placeholder, text]) => page.replaceAll(placeholder, escapeHtml(text)),
        html,
      );
      const unknown = /%WEBFORGE_(?!CSP%)[A-Z_]+%/.exec(filled);
      if (unknown !== null) throw new Error(`No words for ${unknown[0]} in the start-up screen`);
      return filled;
    },
  };
}

const BASE64_SUFFIX = "?base64";
const BASE64_PREFIX = "\0webforge-base64:";

/**
 * Inlines a binary file (`import data from "x.wasm?base64"`) as a base64 string. Vite has no
 * `?inline` for WebAssembly; the export worker bundles its codecs and fonts this way so nothing is
 * read from app.asar at run time.
 */
function inlineBase64(): Plugin {
  return {
    name: "webforge:inline-base64",
    enforce: "pre",
    async resolveId(source, importer) {
      if (!source.endsWith(BASE64_SUFFIX)) {
        return null;
      }
      const resolved = await this.resolve(source.slice(0, -BASE64_SUFFIX.length), importer, {
        skipSelf: true,
      });
      return resolved === null ? null : `${BASE64_PREFIX}${resolved.id}`;
    },
    async load(id) {
      if (!id.startsWith(BASE64_PREFIX)) {
        return null;
      }
      const data = await readFile(id.slice(BASE64_PREFIX.length));
      return `export default ${JSON.stringify(data.toString("base64"))};`;
    },
  };
}

/**
 * fflate's Node build declares a `require` of its own at its top level (`createRequire('/')`), and
 * electron-vite's CommonJS shim declares `const require` in every chunk that calls one: in the same
 * chunk, the main process fails to load ("Identifier 'require' has already been declared"), unless
 * the bundler happens to rename fflate's. Since main's start-up chunks are small (#892), it doesn't:
 * fflate's is renamed here. Fails the build if fflate's code no longer reads as expected.
 */
function fflateRequire(): Plugin {
  const declared = "var require = createRequire('/');";
  const called = "_a = require('worker_threads')";
  return {
    name: "webforge:fflate-require",
    transform(code, id) {
      if (!/[\\/]fflate[\\/]esm[\\/]index\.mjs$/.test(id)) return null;
      if (!code.includes(declared) || !code.includes(called)) {
        throw new Error("fflate's own require has changed: update webforge:fflate-require");
      }
      return code
        .replace(declared, "var fflateRequire = createRequire('/');")
        .replace(called, "_a = fflateRequire('worker_threads')");
    },
  };
}

/** The catalogue `@webforge/themes` bundles (2.2), the parts the copy below needs. */
type FontCatalogue = {
  readonly families: readonly {
    readonly package: string;
    readonly files: readonly {
      readonly file: string;
      readonly bytes: number;
      readonly sha256: string;
    }[];
  }[];
};

/**
 * Copies the installer's fonts (2.2) into `out/fonts`, which electron-builder puts beside app.asar
 * (`extraResources`): every file the catalogue lists, from the font packages `@webforge/pipeline`
 * depends on, each checked against the catalogue's size and SHA-256. A file already there and
 * exactly as listed is left alone, and one the catalogue no longer lists is removed, so the
 * installer ships exactly the catalogue. The main process checks each file again when it reads it.
 */
function bundleFonts(): Plugin {
  const root = fileURLToPath(new URL(".", import.meta.url));
  return {
    name: "webforge:bundle-fonts",
    async closeBundle() {
      const catalogue = JSON.parse(
        await readFile(join(root, "../../packages/themes/src/fonts/catalogue.json"), "utf8"),
      ) as FontCatalogue;
      const fromPipeline = createRequire(join(root, "../../packages/pipeline/package.json"));
      const target = join(root, "out", "fonts");
      await mkdir(target, { recursive: true });
      const listed = new Set(
        catalogue.families.flatMap((font) => font.files.map((each) => each.file)),
      );
      for (const file of await readdir(target)) {
        if (!listed.has(file)) await rm(join(target, file));
      }
      for (const font of catalogue.families) {
        for (const { file, bytes, sha256 } of font.files) {
          const destination = join(target, file);
          const there = await readFile(destination).catch(() => undefined);
          if (there !== undefined && createHash("sha256").update(there).digest("hex") === sha256) {
            continue;
          }
          const data = await readFile(fromPipeline.resolve(`${font.package}/files/${file}`));
          const hash = createHash("sha256").update(data).digest("hex");
          if (data.byteLength !== bytes || hash !== sha256) {
            throw new Error(`${font.package}/files/${file} isn't the catalogue's file`);
          }
          await writeFile(destination, data);
        }
      }
    },
  };
}

/**
 * Copies the templates (2.14a) into `out/templates`, which electron-builder puts beside app.asar
 * (`extraResources`): each template's folder from `@webforge/templates`, as it is. The main process
 * checks each template against its schemas when it reads it.
 */
function bundleTemplates(): Plugin {
  const root = fileURLToPath(new URL(".", import.meta.url));
  return {
    name: "webforge:bundle-templates",
    async closeBundle() {
      const target = join(root, "out", "templates");
      await rm(target, { recursive: true, force: true });
      await cp(join(root, "../../packages/templates/templates"), target, { recursive: true });
    },
  };
}

/**
 * Bundles the bridge (ADR 0021) into `out/bridge/webforge-bridge.mjs`, which electron-builder puts
 * beside app.asar (`extraResources`): *Install in Claude Desktop* writes it into each extension.
 * The files it holds go into `bundled`, for the third-party notices.
 */
function bundleBridge(bundled: Set<string>): Plugin {
  const root = fileURLToPath(new URL(".", import.meta.url));
  return {
    name: "webforge:bundle-bridge",
    async closeBundle() {
      for (const file of await buildBridge(join(root, "out", "bridge", "webforge-bridge.mjs"))) {
        bundled.add(file);
      }
    },
  };
}

/**
 * Writes the third-party notices (5.3, C1) into `out/notices`, which electron-builder puts beside
 * app.asar (`extraResources`): the Open-Source Licences screen's `notices.json`, and
 * THIRD_PARTY_NOTICES.txt. They list every package the app ships: those whose files the main,
 * preload and renderer bundles and the bridge loaded (`bundled`, which each build adds to), the
 * main process's dependencies with all of theirs (electron-builder copies them as they are), the
 * installer's fonts (2.2) and Electron. Written after each build, so the last has them all,
 * whichever order the builds run in.
 */
function thirdPartyNotices(bundled: Set<string>): Plugin {
  const root = fileURLToPath(new URL(".", import.meta.url));
  return {
    name: "webforge:third-party-notices",
    buildEnd() {
      for (const id of this.getModuleIds()) bundled.add(id);
    },
    async closeBundle() {
      const dirs = new Set<string>();
      for (const id of bundled) {
        const dir = packageDirOf(id);
        if (dir !== undefined) dirs.add(dir);
      }
      const desktop = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
        readonly dependencies: Readonly<Record<string, string>>;
      };
      for (const dir of dependencyDirs(root, Object.keys(desktop.dependencies))) dirs.add(dir);
      const catalogue = JSON.parse(
        await readFile(join(root, "../../packages/themes/src/fonts/catalogue.json"), "utf8"),
      ) as FontCatalogue;
      const shipped = [
        ...catalogue.families.map((font) => ({
          from: "../../packages/pipeline",
          name: font.package,
        })),
        { from: ".", name: "electron" },
      ];
      for (const { from, name } of shipped) {
        const dir = findPackageDir(join(root, from), name);
        if (dir === undefined) throw new Error(`${name} isn't installed: run pnpm install`);
        dirs.add(dir);
      }
      await writeNotices(join(root, "out", "notices"), collectNotices(dirs));
    },
  };
}

export default defineConfig(({ command }) => {
  // The dev server injects inline scripts and styles (HMR, React Refresh); a per-run nonce lets
  // them through without weakening the policy to 'unsafe-inline'.
  const devNonce = command === "serve" ? randomBytes(16).toString("base64") : undefined;
  // The files every build bundled, for the third-party notices: shared by the three builds.
  const bundled = new Set<string>();

  return {
    main: {
      plugins: [
        inlineBase64(),
        fflateRequire(),
        bundleFonts(),
        bundleTemplates(),
        bundleBridge(bundled),
        thirdPartyNotices(bundled),
      ],
      build: {
        rolldownOptions: {
          // The export worker runs in its own utility process (07); it bundles the pipeline. The
          // storage writer is a worker thread of the main process (R13b, ADR 0013).
          input: {
            index: "src/main/index.ts",
            "export-worker": "src/worker/export-worker.ts",
            "storage-writer": "src/worker/storage-writer.ts",
          },
        },
      },
    },
    preload: {
      plugins: [thirdPartyNotices(bundled)],
      build: {
        // A sandboxed preload can't load another file: each entry is one file, with no chunk shared
        // between them.
        isolatedEntries: true,
        rolldownOptions: {
          // The editor window's, and the Help window's own (5.4b), which gives its page far less.
          input: { index: "src/preload/index.ts", help: "src/preload/help.ts" },
          // Sandboxed preload scripts cannot be ES modules.
          output: { format: "cjs" },
        },
      },
    },
    renderer: {
      // The React Compiler memoizes the editor's components and hooks (ADR 0010); `pnpm
      // react-compiler` fails on anything it can't compile. Not the site components: compiled,
      // they made the large page load and drag about twice as slowly, and the export renders them
      // uncompiled anyway.
      plugins: [
        react(),
        babel({
          presets: [reactCompilerPreset()],
          exclude: [/[\\/]node_modules[\\/]/, /[\\/]packages[\\/]site-components[\\/]/],
        }),
        tailwindcss(),
        contentSecurityPolicy(devNonce),
        startupScreen(),
        thirdPartyNotices(bundled),
      ],
      ...(devNonce === undefined ? {} : { html: { cspNonce: devNonce } }),
      build: {
        rolldownOptions: {
          // Webforge's own modules are left out when nothing they export is used, so the start
          // screen's first bundle holds none of the editor's code (#896).
          treeshake: { moduleSideEffects },
          // The editor's page, and the Help window's (5.4b), each with the same policy.
          input: {
            index: fileURLToPath(new URL("src/renderer/index.html", import.meta.url)),
            help: fileURLToPath(new URL("src/renderer/help.html", import.meta.url)),
          },
        },
      },
    },
  };
});
