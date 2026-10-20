import { resolve, sep } from "node:path";

/** Cloud sync clients that copy files while they change (ADR 0003 §4). */
export type SyncService = "onedrive" | "dropbox" | "icloud" | "google-drive";

/** Environment variables the sync clients set on Windows, with their folder. */
const ENV_FOLDERS: readonly (readonly [string, SyncService])[] = [
  ["OneDrive", "onedrive"],
  ["OneDriveCommercial", "onedrive"],
  ["OneDriveConsumer", "onedrive"],
];

/**
 * Folder names that mark a synced folder, compared case-insensitively against each part of the
 * path. `OneDrive - Contoso` and macOS's `CloudStorage/OneDrive-Personal` both start with
 * `onedrive`; `My Drive` is Google Drive's mount on Windows (`G:\My Drive`).
 */
function serviceOfSegment(segment: string, next: string | undefined): SyncService | undefined {
  const name = segment.toLowerCase();
  if (name === "onedrive" || name.startsWith("onedrive -") || name.startsWith("onedrive-")) {
    return "onedrive";
  }
  if (name === "dropbox" || name.startsWith("dropbox (") || name.startsWith("dropbox-")) {
    return "dropbox";
  }
  if (name === "icloud drive" || name === "iclouddrive" || name === "mobile documents") {
    return "icloud";
  }
  if (name === "google drive" || name.startsWith("googledrive-")) {
    return "google-drive";
  }
  if (name === "my drive" && next !== undefined) {
    return "google-drive";
  }
  return undefined;
}

/**
 * Which cloud sync client, if any, watches the folder of a site at `path`. Webforge then shows a
 * gentle warning: syncing works, but a copy taken mid-save can arrive torn, and two computers
 * editing one file make conflict copies (research/stack/06, ADR 0003 §4). A best guess from the
 * path and the clients' environment variables; it never touches the disk.
 */
export function detectSyncFolder(
  path: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): SyncService | undefined {
  const full = resolve(path);
  const compare = (value: string) => (sep === "\\" ? value.toLowerCase() : value);
  for (const [variable, service] of ENV_FOLDERS) {
    const folder = env[variable];
    if (folder !== undefined && folder !== "") {
      const root = compare(resolve(folder));
      const target = compare(full);
      if (target === root || target.startsWith(root.endsWith(sep) ? root : root + sep)) {
        return service;
      }
    }
  }
  const segments = full.split(/[\\/]/).filter((segment) => segment !== "");
  for (const [index, segment] of segments.entries()) {
    const service = serviceOfSegment(segment, segments[index + 1]);
    if (service !== undefined) {
      return service;
    }
  }
  return undefined;
}
