// Stylesheets are bundled by Vite; importing one has no value in TypeScript.
declare module "@puckeditor/core/no-external.css";

// Vite's build flags, which the renderer's build and Vitest set: the canvas checks its echoes in a
// development or test build only (A24). As `vite/client` declares them, which the renderer has.
interface ImportMetaEnv {
  DEV: boolean;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// A stylesheet's text (Vite's `?raw`): the DOM contract test reads Puck's for what it names (A20).
declare module "*.css?raw" {
  const css: string;
  export default css;
}
