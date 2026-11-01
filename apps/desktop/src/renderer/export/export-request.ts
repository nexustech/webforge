import type { SiteDoc } from "@webforge/model";
import { type ComponentLibrary, siteContentFor } from "@webforge/site-components";
import type { ExportChoices, ExportRequest } from "../../shared/ipc/site.js";

/**
 * What the export command sends for `site`: its content (`siteContentFor`, ADR 0018 §3), with the
 * person's `choices`, to remember with the site, and what this export writes, `output` (3.3).
 */
export function exportRequestFor(
  site: SiteDoc,
  library: ComponentLibrary,
  choices: ExportChoices,
  output: ExportRequest["output"],
): ExportRequest {
  return { ...siteContentFor(site, library), choices, output };
}
