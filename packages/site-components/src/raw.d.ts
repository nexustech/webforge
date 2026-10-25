// Vite (and Vitest) import a file's text with the `?raw` suffix.
declare module "*?raw" {
  const content: string;
  export default content;
}

// Vite (and Vitest) collect the files a pattern matches when the module loads, here as their text.
interface ImportMeta {
  glob(
    pattern: string,
    options: { readonly query: "?raw"; readonly import: "default"; readonly eager: true },
  ): Record<string, string>;
}

// Each theme preset's compiled stylesheet, by preset name, for the theme stories (2.13; written by
// .storybook/theme-gallery.ts).
declare module "virtual:webforge-theme-css" {
  const stylesheets: Readonly<Record<string, string>>;
  export default stylesheets;
}
