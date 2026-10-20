// daisyUI ships no type declarations; the pipeline only passes its plugin on to Tailwind.
declare module "daisyui" {
  const plugin: unknown;
  export default plugin;
}
