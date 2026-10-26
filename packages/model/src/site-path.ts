import { z } from "zod";

/**
 * A relative site path: `/`-separated, no leading `/`, no empty, `.` or `..` segments, no `\` or
 * `:` (a Windows drive or stream).
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
      path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== ".."),
    { message: "Not a relative site path" },
  );
