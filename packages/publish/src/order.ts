const HOME_PAGE = "index.html";

function rank(path: string): number {
  if (path === HOME_PAGE) return 2;
  return path.endsWith(".html") ? 1 : 0;
}

/**
 * Sorts paths into upload order (08): assets first, then pages, then the home page last, so a
 * visitor never gets a page that points at files not uploaded yet. Paths of the same kind are
 * sorted alphabetically, so the order is stable.
 */
export function uploadOrder(paths: Iterable<string>): string[] {
  return [...paths].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
}
