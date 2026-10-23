// daisyUI ships no type declarations; the pipeline only passes its plugin on to Tailwind.
declare module "daisyui" {
  const plugin: unknown;
  export default plugin;
}

// daisyUI's custom-theme plugin, which the site's own theme is written for (2.1).
declare module "daisyui/theme" {
  const plugin: unknown;
  export default plugin;
}
