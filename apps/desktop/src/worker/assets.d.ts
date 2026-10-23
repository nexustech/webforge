// Vite imports a file's text with `?raw`; the build's ?base64 plugin (electron.vite.config.ts)
// imports its bytes as a base64 string.
declare module "*?raw" {
  const content: string;
  export default content;
}

declare module "*?base64" {
  const base64: string;
  export default base64;
}

// daisyUI ships no type declarations; the worker only passes its plugin on to the pipeline.
declare module "daisyui" {
  const plugin: unknown;
  export default plugin;
}

// daisyUI's custom-theme plugin, which the site's own theme is written for (2.1).
declare module "daisyui/theme" {
  const plugin: unknown;
  export default plugin;
}
