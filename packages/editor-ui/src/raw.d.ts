// Vite (and Vitest) import a file's text with the `?raw` suffix.
declare module "*?raw" {
  const content: string;
  export default content;
}
