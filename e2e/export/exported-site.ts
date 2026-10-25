import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Where the setup project exports the fixture site for the browser projects to open. CI sets
 * WEBFORGE_EXPORTED_SITE_DIR: the E2E job exports there and uploads it, and the Firefox and WebKit
 * job runs the browser projects on the downloaded copy, in Playwright's container (no setup).
 */
export const EXPORTED_SITE_DIR =
  process.env.WEBFORGE_EXPORTED_SITE_DIR ?? join(tmpdir(), "webforge-e2e-exported-site");

/** The `file://` URL of a page of the exported fixture site. */
export function exportedPageUrl(page: string): string {
  return pathToFileURL(join(EXPORTED_SITE_DIR, page)).href;
}

/**
 * Where the setup exports the fixture site a second time, in a theme of its own (#423), inside the
 * fixture's folder so CI uploads it with it.
 */
export const THEMED_SITE_DIR = join(EXPORTED_SITE_DIR, "themed");

/** The `file://` URL of a page of the themed export. */
export function themedPageUrl(page: string): string {
  return pathToFileURL(join(THEMED_SITE_DIR, page)).href;
}
