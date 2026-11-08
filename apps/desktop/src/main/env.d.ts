// electron-vite replaces `import.meta.env.MODE` at build time ("production", or `--mode`'s value),
// so a branch on it is dropped from builds of other modes.
// `MAIN_VITE_*` variables of the environment the app is built in are replaced the same way: a
// release build sets them, and a build without one leaves it undefined.
interface ImportMeta {
  readonly env: {
    readonly MODE: string;
    /** Webforge's Netlify OAuth client ID (4.2, ADR 0006): public, set once the app is registered. */
    readonly MAIN_VITE_NETLIFY_CLIENT_ID?: string;
  };
}
