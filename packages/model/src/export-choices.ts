import { z } from "zod";

/**
 * What the person chose when exporting a site (3.3): a folder or a ZIP, *Minify output* (X4),
 * *Include developer files* (X6, offered in Advanced mode), and whether to ask for the web address
 * while it's empty (X3). The site file remembers them for its next export, as UI state like the
 * editor mode: never versioned. The renderer, the main process and storage all check them here.
 */
export const exportChoicesSchema = z.strictObject({
  format: z.enum(["folder", "zip"]),
  minify: z.boolean(),
  developerFiles: z.boolean(),
  askWebAddress: z.boolean(),
});

/** What the person chose when exporting a site. */
export type ExportChoices = z.infer<typeof exportChoicesSchema>;

/** The choices of a site that has never been exported. */
export const DEFAULT_EXPORT_CHOICES: ExportChoices = {
  format: "folder",
  minify: false,
  developerFiles: false,
  askWebAddress: true,
};
