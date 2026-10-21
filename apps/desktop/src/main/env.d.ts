// electron-vite replaces `import.meta.env.MODE` at build time ("production", or `--mode`'s value),
// so a branch on it is dropped from builds of other modes.
interface ImportMeta {
  readonly env: { readonly MODE: string };
}
