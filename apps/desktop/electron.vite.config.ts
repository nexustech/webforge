import { randomBytes } from "node:crypto";
import react from "@vitejs/plugin-react";
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

export default defineConfig(({ command }) => {
  // The dev server injects inline scripts and styles (HMR, React Refresh); a per-run nonce lets
  // them through without weakening the policy to 'unsafe-inline'.
  const devNonce = command === "serve" ? randomBytes(16).toString("base64") : undefined;

  return {
    main: {},
    preload: {
      build: {
        // Sandboxed preload scripts cannot be ES modules.
        rolldownOptions: { output: { format: "cjs" } },
      },
    },
    renderer: {
      plugins: [react(), contentSecurityPolicy(devNonce)],
      ...(devNonce === undefined ? {} : { html: { cspNonce: devNonce } }),
    },
  };
});
