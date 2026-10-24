import { t } from "@webforge/i18n";
import type { MediaMeta } from "@webforge/model";
import {
  MAX_IMPORT_REQUEST_BYTES,
  MAX_MEDIA_BYTES,
  MAX_MEDIA_FILES,
  type MediaApi,
} from "../../shared/ipc/media.js";
import type { MediaImportResult } from "../../shared/ipc-contract.js";
import { reportFailure } from "../log.js";
import { siteSession } from "../storage/site-session.js";

/** The parts of a dropped `File` the import reads. */
export type DroppedFileLike = Pick<File, "name" | "size" | "arrayBuffer">;

type Rejected = Extract<MediaImportResult, { status: "imported" }>["rejected"][number];

/** Groups files into requests the main process takes: at most 100 MB and 50 files each. */
function batches(files: readonly DroppedFileLike[]): DroppedFileLike[][] {
  const groups: DroppedFileLike[][] = [];
  let current: DroppedFileLike[] = [];
  let bytes = 0;
  for (const file of files) {
    if (
      current.length > 0 &&
      (bytes + file.size > MAX_IMPORT_REQUEST_BYTES || current.length === MAX_MEDIA_FILES)
    ) {
      groups.push(current);
      current = [];
      bytes = 0;
    }
    current.push(file);
    bytes += file.size;
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

/**
 * Imports files dropped on the Media panel. They go to the main process in batches, each read only
 * when it is sent, so a large drop never sits in memory at once; a file over 50 MB isn't read at
 * all. The results come back as one import.
 */
export async function importDroppedFiles(
  files: readonly DroppedFileLike[],
  media: Pick<MediaApi, "import">,
): Promise<MediaImportResult> {
  const items: MediaMeta[] = [];
  const rejected: Rejected[] = files
    .filter((file) => file.size > MAX_MEDIA_BYTES)
    .map((file) => ({ fileName: file.name, reason: "too-large" }));
  for (const group of batches(files.filter((file) => file.size <= MAX_MEDIA_BYTES))) {
    const read = await Promise.all(
      group.map(async (file) => {
        try {
          return { fileName: file.name, data: new Uint8Array(await file.arrayBuffer()) };
        } catch {
          // A dropped folder, or a file gone since the drop.
          rejected.push({ fileName: file.name, reason: "unsupported" });
          return undefined;
        }
      }),
    );
    const payload = read.filter((file) => file !== undefined);
    if (payload.length === 0) {
      continue;
    }
    const result = await media.import(siteSession(), payload);
    if (result.status !== "imported") {
      return result;
    }
    items.push(...result.items);
    rejected.push(...result.rejected);
  }
  return { status: "imported", items, rejected };
}

/** What a file that wasn't added says, by why. */
const REJECTED_MESSAGE = {
  "too-large": "site.media.rejected.tooLarge",
  unsupported: "site.media.rejected.unsupported",
  "not-text": "site.media.rejected.notText",
} as const;

/** What the user is told about files that weren't added, or about an import that failed. */
export function importMessages(result: MediaImportResult): string[] {
  switch (result.status) {
    case "canceled":
      return [];
    case "failed":
      return [
        result.reason === "read-only"
          ? t("site.media.failed.readOnly")
          : t("site.media.failed.unknown"),
      ];
    case "imported":
      return result.rejected.map(({ fileName, reason }) =>
        t(REJECTED_MESSAGE[reason], { name: fileName }),
      );
  }
}

/**
 * Runs an import (a drop, the Add dialog or Replace) and tells the user about anything left out.
 * Returns the items it brought, for the caller to add to Media or put in an item's place.
 */
export async function importItems(
  request: () => Promise<MediaImportResult>,
  notify: (message: string) => void,
): Promise<readonly MediaMeta[]> {
  let result: MediaImportResult;
  try {
    result = await request();
  } catch (error) {
    reportFailure("media.import", error);
    result = { status: "failed", reason: "unknown" };
  }
  for (const message of importMessages(result)) notify(message);
  return result.status === "imported" ? result.items : [];
}
