import { z } from "zod";

/** Names Windows keeps for devices: a file called one (`con.html` too) can't be written there. */
const DEVICE_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
]);

/**
 * Whether `segment`, a file or folder name, is a Windows device name: the part before its first
 * dot, in any case (`con`, `CON.html`, `aux.tar.gz`). Exports refuse them and new pages and
 * folders never get one.
 */
export function isDeviceName(segment: string): boolean {
  return DEVICE_NAMES.has((segment.split(".")[0] ?? "").toLowerCase());
}

/**
 * A relative site path: `/`-separated, no leading `/`, no empty, `.` or `..` segments, no `\` or
 * `:` (a Windows drive or stream), and no Windows device names (`con`, `nul.html`, {@link isDeviceName}).
 * Every path a site's files are written to or removed at is one: an export's files
 * (`writeSiteFolder`) and a publish manifest's (clean-up deletes what it lists, so one read from a
 * server must never point outside the site's folder). Moved here from `publish` (R16).
 */
export const sitePathSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine(
    (path) =>
      !path.includes("\\") &&
      !path.includes(":") &&
      // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it rejects.
      !/[\u0000-\u001f]/.test(path) &&
      path
        .split("/")
        .every(
          (segment) =>
            segment !== "" && segment !== "." && segment !== ".." && !isDeviceName(segment),
        ),
    { message: "Not a relative site path" },
  );
