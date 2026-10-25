import { createHash, randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import type { Plugin } from "vite";
import { buildContentSecurityPolicy } from "./src/shared/content-security-policy.js";

const CSP_PLACEHOLDER = 'content="%WEBFORGE_CSP%"';

/** Fills the Content-Security-Policy meta tag of index.html; fails the build if it is missing. */
function contentSecurityPolicy(devNonce: string | undefined): Plugin {
  const csp = buildContentSecurityPolicy(devNonce === undefined ? {} : { devNonce });
  return {
    name: "webforge:content-security-policy",
    transformIndexHtml: (html) => {
      if (!html.includes(CSP_PLACEHOLDER)) {
        throw new Error(`index.html must contain a CSP meta tag with ${CSP_PLACEHOLDER}`);
      }
      return html.replace(CSP_PLACEHOLDER, `content="${csp}"`);
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

export default defineConfig(({ command }) => {
  // The dev server injects inline scripts and styles (HMR, React Refresh); a per-run nonce lets
  // them through without weakening the policy to 'unsafe-inline'.
  const devNonce = command === "serve" ? randomBytes(16).toString("base64") : undefined;

  return {
    main: {
      plugins: [inlineBase64(), bundleFonts()],
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
      build: {
        // Sandboxed preload scripts cannot be ES modules.
        rolldownOptions: { output: { format: "cjs" } },
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
      ],
      ...(devNonce === undefined ? {} : { html: { cspNonce: devNonce } }),
    },
  };
});
