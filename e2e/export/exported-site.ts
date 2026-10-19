import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Where the setup project exports the fixture site for the browser projects to open. */
export const EXPORTED_SITE_DIR = join(tmpdir(), "webforge-e2e-exported-site");

/** The `file://` URL of a page of the exported fixture site. */
export function exportedPageUrl(page: string): string {
  return pathToFileURL(join(EXPORTED_SITE_DIR, page)).href;
}
