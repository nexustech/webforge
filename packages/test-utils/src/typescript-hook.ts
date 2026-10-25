/**
 * The URL of a module hook that lets plain Node run the repository's TypeScript sources: for a
 * child process or a worker thread a test starts (`--import <this URL>`), which Vitest's own
 * transform doesn't reach. Relative imports are written with `.js` extensions (repo convention),
 * so the hook falls back to the `.ts` file next to them.
 */
export const TYPESCRIPT_HOOK = new URL("./resolve-ts.ts", import.meta.url).href;
