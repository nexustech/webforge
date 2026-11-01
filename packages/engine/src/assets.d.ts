// Stylesheets are bundled by Vite; importing one has no value in TypeScript.
declare module "@puckeditor/core/no-external.css";

// A stylesheet's text (Vite's `?raw`): the DOM contract test reads Puck's for what it names (A20).
declare module "*.css?raw" {
  const css: string;
  export default css;
}
