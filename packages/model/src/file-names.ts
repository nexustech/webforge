/** Characters no file name may have on Windows, macOS or Linux. */
const UNSAFE_IN_FILE_NAMES = /[<>:"/\\|?*\p{Cc}]/gu;

/** Names Windows keeps for devices, which no file may have, whatever its extension. */
const RESERVED_FILE_NAMES = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/**
 * `name` as a file name every system can save and unpack: characters a file name can't have
 * become "-", and trailing dots and spaces go, as Windows drops them. `fallback` when nothing
 * usable is left, or when the name before its first dot is one Windows keeps for a device
 * (`CON`, `con.jpg`). Used for the file names the save dialogs offer and a site ZIP's entries.
 */
export function safeFileName(name: string, fallback: string): string {
  const cleaned = name
    .replace(UNSAFE_IN_FILE_NAMES, "-")
    .trim()
    .replace(/[. ]+$/, "");
  const stem = cleaned.split(".")[0] ?? "";
  return cleaned === "" || RESERVED_FILE_NAMES.test(stem.trim()) ? fallback : cleaned;
}
