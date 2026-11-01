import { extname, resolve } from "node:path";

/** File extension of a Webforge site (P1). */
export const PROJECT_EXTENSION = ".wforge";

/** Adds `.wforge` unless the path already ends with it (any letter case). */
export function withProjectExtension(path: string): string {
  return extname(path).toLowerCase() === PROJECT_EXTENSION ? path : `${path}${PROJECT_EXTENSION}`;
}

/**
 * The `.wforge` file passed on the command line: on Windows, double-clicking a site starts
 * Webforge with its path (P1 file association). macOS sends the app's `open-file` event instead.
 * Switches such as `--inspect` are skipped.
 */
export function findProjectArgument(argv: readonly string[]): string | undefined {
  return argv
    .slice(1)
    .find((arg) => !arg.startsWith("-") && extname(arg).toLowerCase() === PROJECT_EXTENSION);
}

/** Whether two paths name the same file (case-insensitively on Windows). */
export function samePath(a: string, b: string): boolean {
  const normalise = (path: string) =>
    process.platform === "win32" ? resolve(path).toLowerCase() : resolve(path);
  return normalise(a) === normalise(b);
}
