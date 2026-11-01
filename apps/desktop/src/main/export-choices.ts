import { DEFAULT_EXPORT_CHOICES, type ExportChoices } from "@webforge/model";
import { ReadOnlyProjectError } from "@webforge/storage";
import { logFailure } from "./log.js";
import type { SiteStore } from "./site-store.js";

/**
 * What the person chose for the site's last export (3.3); the defaults without a site, or once
 * another has opened.
 */
export function exportChoices(site: SiteStore): Promise<ExportChoices> {
  return site.withStore(
    "shared",
    (store) => store.readExportChoices(),
    () => DEFAULT_EXPORT_CHOICES,
  );
}

/**
 * Remembers what the person chose for an export with the site, like the editor state; never with
 * another that has opened since (#663). A read-only site keeps its earlier choices: that never stops
 * the export.
 */
export function setExportChoices(site: SiteStore, choices: ExportChoices): Promise<void> {
  return site.withStore(
    "shared",
    (store) => {
      try {
        store.writeExportChoices(choices);
      } catch (error) {
        if (!(error instanceof ReadOnlyProjectError)) {
          logFailure("Webforge could not remember the export choices", error);
        }
      }
    },
    () => undefined,
  );
}
