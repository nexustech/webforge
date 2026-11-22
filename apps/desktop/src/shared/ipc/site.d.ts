import type { ExportChoices } from "@webforge/model";
import { z } from "zod";

export type { ExportChoices };

/**
 * What the renderer sends to export the site: its snapshot, the Media images and documents it may
 * use, the person's choices to remember with the site, and what this export writes. The two differ
 * where an option isn't offered: Simple mode never writes developer files, but keeps the choice
 * Advanced mode made (3.3).
 */
declare const exportRequestSchema: z.ZodObject<
  {
    snapshot: z.ZodType<
      import("@webforge/model").SiteSnapshot,
      unknown,
      z.core.$ZodTypeInternals<import("@webforge/model").SiteSnapshot, unknown>
    >;
    media: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          name: z.ZodString;
          mimeType: z.ZodEnum<{
            "image/jpeg": "image/jpeg";
            "image/png": "image/png";
          }>;
          hash: z.ZodString;
          alt: z.ZodString;
          focal: z.ZodOptional<
            z.ZodObject<
              {
                x: z.ZodNumber;
                y: z.ZodNumber;
              },
              z.core.$strict
            >
          >;
          crop: z.ZodOptional<
            z.ZodObject<
              {
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
              },
              z.core.$strict
            >
          >;
        },
        z.core.$strict
      >
    >;
    documents: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            id: z.ZodString;
            name: z.ZodString;
            mimeType: z.ZodEnum<{
              "application/msword": "application/msword";
              "application/pdf": "application/pdf";
              "application/vnd.ms-excel": "application/vnd.ms-excel";
              "application/vnd.ms-powerpoint": "application/vnd.ms-powerpoint";
              "application/vnd.oasis.opendocument.presentation": "application/vnd.oasis.opendocument.presentation";
              "application/vnd.oasis.opendocument.spreadsheet": "application/vnd.oasis.opendocument.spreadsheet";
              "application/vnd.oasis.opendocument.text": "application/vnd.oasis.opendocument.text";
              "application/vnd.openxmlformats-officedocument.presentationml.presentation": "application/vnd.openxmlformats-officedocument.presentationml.presentation";
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
              "text/csv": "text/csv";
              "text/plain": "text/plain";
            }>;
            hash: z.ZodString;
          },
          z.core.$strict
        >
      >
    >;
    choices: z.ZodObject<
      {
        format: z.ZodEnum<{
          folder: "folder";
          zip: "zip";
        }>;
        minify: z.ZodBoolean;
        developerFiles: z.ZodBoolean;
        askWebAddress: z.ZodBoolean;
      },
      z.core.$strict
    >;
    output: z.ZodObject<
      {
        minify: z.ZodBoolean;
        developerFiles: z.ZodBoolean;
      },
      z.core.$strict
    >;
  },
  z.core.$strict
>;
/** What the renderer sends to export the site. */
export type ExportRequest = z.infer<typeof exportRequestSchema>;
/**
 * The site as a build takes it from the renderer: its snapshot, and the images and documents it
 * may use by hash. The preview (3.2) sends this; an export adds the person's choices.
 */
export declare const siteContentSchema: z.ZodObject<
  {
    snapshot: z.ZodType<
      import("@webforge/model").SiteSnapshot,
      unknown,
      z.core.$ZodTypeInternals<import("@webforge/model").SiteSnapshot, unknown>
    >;
    media: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          name: z.ZodString;
          mimeType: z.ZodEnum<{
            "image/jpeg": "image/jpeg";
            "image/png": "image/png";
          }>;
          hash: z.ZodString;
          alt: z.ZodString;
          focal: z.ZodOptional<
            z.ZodObject<
              {
                x: z.ZodNumber;
                y: z.ZodNumber;
              },
              z.core.$strict
            >
          >;
          crop: z.ZodOptional<
            z.ZodObject<
              {
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
              },
              z.core.$strict
            >
          >;
        },
        z.core.$strict
      >
    >;
    documents: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            id: z.ZodString;
            name: z.ZodString;
            mimeType: z.ZodEnum<{
              "application/msword": "application/msword";
              "application/pdf": "application/pdf";
              "application/vnd.ms-excel": "application/vnd.ms-excel";
              "application/vnd.ms-powerpoint": "application/vnd.ms-powerpoint";
              "application/vnd.oasis.opendocument.presentation": "application/vnd.oasis.opendocument.presentation";
              "application/vnd.oasis.opendocument.spreadsheet": "application/vnd.oasis.opendocument.spreadsheet";
              "application/vnd.oasis.opendocument.text": "application/vnd.oasis.opendocument.text";
              "application/vnd.openxmlformats-officedocument.presentationml.presentation": "application/vnd.openxmlformats-officedocument.presentationml.presentation";
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
              "text/csv": "text/csv";
              "text/plain": "text/plain";
            }>;
            hash: z.ZodString;
          },
          z.core.$strict
        >
      >
    >;
  },
  z.core.$strict
>;
/** The site as a build takes it from the renderer. */
export type SiteContent = z.infer<typeof siteContentSchema>;
/** Why an export failed; the renderer shows a translated message for each. */
export declare const EXPORT_FAILURES: readonly [
  "folder-not-empty",
  "build-failed",
  "write-failed",
  "reserved-name",
  "too-large",
  "unreadable-image",
];
/** One of {@link EXPORT_FAILURES}. */
export type ExportFailure = (typeof EXPORT_FAILURES)[number];
/**
 * A problem the export found that didn't stop it (X5), for the export report: a link to a page or
 * file that isn't there, or an image deleted from Media. `page` is the page's path ("" for the
 * whole site); `detail` what the link pointed at, or the image's id. `not-minified`: *Minify
 * output* left the page readable. `missing-icon`, `small-icon`: the site icon gave no favicon.
 * `custom-script`: the site's `custom.js` has a mistake; `detail` is its line (3.9).
 */
export declare const exportWarningSchema: z.ZodObject<
  {
    code: z.ZodEnum<{
      "broken-link": "broken-link";
      "custom-script": "custom-script";
      "form-unset": "form-unset";
      "missing-icon": "missing-icon";
      "missing-image": "missing-image";
      "missing-kept-file": "missing-kept-file";
      "not-minified": "not-minified";
      "small-icon": "small-icon";
    }>;
    page: z.ZodString;
    detail: z.ZodString;
  },
  z.core.$strict
>;
/** At most this many warnings reach the report; it says how many more there were. */
export declare const MAX_REPORTED_WARNINGS = 500;
/** Outcome of exporting the site to a folder or a ZIP. */
declare const exportResultSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        status: z.ZodLiteral<"exported">;
        format: z.ZodEnum<{
          folder: "folder";
          zip: "zip";
        }>;
        name: z.ZodString;
        location: z.ZodString;
        pages: z.ZodInt;
        files: z.ZodInt;
        bytes: z.ZodInt;
        warnings: z.ZodArray<
          z.ZodObject<
            {
              code: z.ZodEnum<{
                "broken-link": "broken-link";
                "custom-script": "custom-script";
                "form-unset": "form-unset";
                "missing-icon": "missing-icon";
                "missing-image": "missing-image";
                "missing-kept-file": "missing-kept-file";
                "not-minified": "not-minified";
                "small-icon": "small-icon";
              }>;
              page: z.ZodString;
              detail: z.ZodString;
            },
            z.core.$strict
          >
        >;
        warningCount: z.ZodInt;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"canceled">;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"failed">;
        reason: z.ZodEnum<{
          "build-failed": "build-failed";
          "folder-not-empty": "folder-not-empty";
          "reserved-name": "reserved-name";
          "too-large": "too-large";
          "unreadable-image": "unreadable-image";
          "write-failed": "write-failed";
        }>;
        page: z.ZodOptional<z.ZodString>;
        image: z.ZodOptional<z.ZodString>;
      },
      z.core.$strict
    >,
  ],
  "status"
>;
/** Outcome of exporting the site to a folder or a ZIP. */
export type ExportResult = z.infer<typeof exportResultSchema>;
/**
 * How far an export has come (3.1): the stage it has started, and for images and pages which one
 * (from 0) of how many. `writing` is the folder being written.
 */
export declare const exportProgressSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        stage: z.ZodEnum<{
          images: "images";
          pages: "pages";
        }>;
        done: z.ZodInt;
        total: z.ZodInt;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        stage: z.ZodEnum<{
          fonts: "fonts";
          styles: "styles";
          writing: "writing";
        }>;
      },
      z.core.$strict
    >,
  ],
  "stage"
>;
/** How far an export has come. */
export type ExportProgress = z.infer<typeof exportProgressSchema>;
/** The most files a stylesheet kept with the site may name, downloaded with it (3.9). */
export declare const BUNDLE_MAX_NESTED = 30;
/**
 * What came of Download and bundle (C8, 3.9): the files to keep with the site, the asked-for one
 * first and then those it names if it's a stylesheet, their bytes stored in the site file; or why
 * not. See `DownloadFailure` in main's bundle-download.ts; the rest are the site's own reasons.
 */
declare const bundleResultSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        status: z.ZodLiteral<"bundled">;
        files: z.ZodArray<
          z.ZodType<
            import("@webforge/model").BundledFile,
            unknown,
            z.core.$ZodTypeInternals<import("@webforge/model").BundledFile, unknown>
          >
        >;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"failed">;
        reason: z.ZodEnum<{
          local: "local";
          "no-site": "no-site";
          "not-a-file": "not-a-file";
          "not-found": "not-found";
          "not-https": "not-https";
          offline: "offline";
          "read-only": "read-only";
          "stale-session": "stale-session";
          "too-large": "too-large";
          unknown: "unknown";
        }>;
      },
      z.core.$strict
    >,
  ],
  "status"
>;
/** What came of Download and bundle. */
export type BundleResult = z.infer<typeof bundleResultSchema>;
/**
 * IPC channels of the `site` domain (`site:*`). Each call that reads or changes the open site
 * names the opening it is for (`sessionId`, R6, #663): main refuses one whose site has gone.
 */
export declare const siteChannels: {
  /**
   * Asks for a folder (open dialog in main), builds the site in a utility process and writes it
   * there (export pipeline, 07), as operation `operationId`, which its progress and its cancel
   * name. An id already under way is refused (`canceled`).
   */
  readonly exportSite: {
    readonly channel: "site:export";
    readonly request: z.ZodTuple<
      [
        z.ZodUUID,
        z.ZodObject<
          {
            snapshot: z.ZodType<
              import("@webforge/model").SiteSnapshot,
              unknown,
              z.core.$ZodTypeInternals<import("@webforge/model").SiteSnapshot, unknown>
            >;
            media: z.ZodArray<
              z.ZodObject<
                {
                  id: z.ZodString;
                  name: z.ZodString;
                  mimeType: z.ZodEnum<{
                    "image/jpeg": "image/jpeg";
                    "image/png": "image/png";
                  }>;
                  hash: z.ZodString;
                  alt: z.ZodString;
                  focal: z.ZodOptional<
                    z.ZodObject<
                      {
                        x: z.ZodNumber;
                        y: z.ZodNumber;
                      },
                      z.core.$strict
                    >
                  >;
                  crop: z.ZodOptional<
                    z.ZodObject<
                      {
                        x: z.ZodNumber;
                        y: z.ZodNumber;
                        width: z.ZodNumber;
                        height: z.ZodNumber;
                      },
                      z.core.$strict
                    >
                  >;
                },
                z.core.$strict
              >
            >;
            documents: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    id: z.ZodString;
                    name: z.ZodString;
                    mimeType: z.ZodEnum<{
                      "application/msword": "application/msword";
                      "application/pdf": "application/pdf";
                      "application/vnd.ms-excel": "application/vnd.ms-excel";
                      "application/vnd.ms-powerpoint": "application/vnd.ms-powerpoint";
                      "application/vnd.oasis.opendocument.presentation": "application/vnd.oasis.opendocument.presentation";
                      "application/vnd.oasis.opendocument.spreadsheet": "application/vnd.oasis.opendocument.spreadsheet";
                      "application/vnd.oasis.opendocument.text": "application/vnd.oasis.opendocument.text";
                      "application/vnd.openxmlformats-officedocument.presentationml.presentation": "application/vnd.openxmlformats-officedocument.presentationml.presentation";
                      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                      "text/csv": "text/csv";
                      "text/plain": "text/plain";
                    }>;
                    hash: z.ZodString;
                  },
                  z.core.$strict
                >
              >
            >;
            choices: z.ZodObject<
              {
                format: z.ZodEnum<{
                  folder: "folder";
                  zip: "zip";
                }>;
                minify: z.ZodBoolean;
                developerFiles: z.ZodBoolean;
                askWebAddress: z.ZodBoolean;
              },
              z.core.$strict
            >;
            output: z.ZodObject<
              {
                minify: z.ZodBoolean;
                developerFiles: z.ZodBoolean;
              },
              z.core.$strict
            >;
          },
          z.core.$strict
        >,
        z.ZodUUID,
      ],
      null
    >;
    readonly response: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            status: z.ZodLiteral<"exported">;
            format: z.ZodEnum<{
              folder: "folder";
              zip: "zip";
            }>;
            name: z.ZodString;
            location: z.ZodString;
            pages: z.ZodInt;
            files: z.ZodInt;
            bytes: z.ZodInt;
            warnings: z.ZodArray<
              z.ZodObject<
                {
                  code: z.ZodEnum<{
                    "broken-link": "broken-link";
                    "custom-script": "custom-script";
                    "form-unset": "form-unset";
                    "missing-icon": "missing-icon";
                    "missing-image": "missing-image";
                    "missing-kept-file": "missing-kept-file";
                    "not-minified": "not-minified";
                    "small-icon": "small-icon";
                  }>;
                  page: z.ZodString;
                  detail: z.ZodString;
                },
                z.core.$strict
              >
            >;
            warningCount: z.ZodInt;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"canceled">;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"failed">;
            reason: z.ZodEnum<{
              "build-failed": "build-failed";
              "folder-not-empty": "folder-not-empty";
              "reserved-name": "reserved-name";
              "too-large": "too-large";
              "unreadable-image": "unreadable-image";
              "write-failed": "write-failed";
            }>;
            page: z.ZodOptional<z.ZodString>;
            image: z.ZodOptional<z.ZodString>;
          },
          z.core.$strict
        >,
      ],
      "status"
    >;
  };
  /** What the person chose for the open site's last export: the defaults until there was one. */
  readonly exportChoices: {
    readonly channel: "site:export-choices";
    readonly request: z.ZodTuple<[z.ZodUUID], null>;
    readonly response: z.ZodObject<
      {
        format: z.ZodEnum<{
          folder: "folder";
          zip: "zip";
        }>;
        minify: z.ZodBoolean;
        developerFiles: z.ZodBoolean;
        askWebAddress: z.ZodBoolean;
      },
      z.core.$strict
    >;
  };
  /**
   * Remembers the person's export choices with the open site at once (3.3): *Don't ask again for
   * this site* holds even if the export that follows is cancelled.
   */
  readonly setExportChoices: {
    readonly channel: "site:set-export-choices";
    readonly request: z.ZodTuple<
      [
        z.ZodUUID,
        z.ZodObject<
          {
            format: z.ZodEnum<{
              folder: "folder";
              zip: "zip";
            }>;
            minify: z.ZodBoolean;
            developerFiles: z.ZodBoolean;
            askWebAddress: z.ZodBoolean;
          },
          z.core.$strict
        >,
      ],
      null
    >;
    readonly response: z.ZodNull;
  };
  /**
   * *Preview from disk* (07): opens the open site's last export, its home page in the default
   * browser or its ZIP file in the file manager. `none` when this site hasn't been exported since
   * it opened; `missing` when the export was moved or deleted since.
   */
  readonly openExport: {
    readonly channel: "site:open-export";
    readonly request: z.ZodTuple<[z.ZodUUID], null>;
    readonly response: z.ZodEnum<{
      missing: "missing";
      none: "none";
      opened: "opened";
    }>;
  };
  /**
   * *Show the Folder* (#1171): shows the open site's last export in the file manager, a folder
   * opened, a ZIP file in its folder. `none` and `missing` as for `openExport`.
   */
  readonly showExport: {
    readonly channel: "site:show-export";
    readonly request: z.ZodTuple<[z.ZodUUID], null>;
    readonly response: z.ZodEnum<{
      missing: "missing";
      none: "none";
      opened: "opened";
    }>;
  };
  /**
   * Cancels export `operationId`, if it is under way (3.1): it stops before its next image or page
   * and answers `canceled`, changing nothing on disk. No other export or operation stops.
   */
  readonly cancelExport: {
    readonly channel: "site:cancel-export";
    readonly request: z.ZodTuple<[z.ZodUUID], null>;
    readonly response: z.ZodNull;
  };
  /**
   * Download and bundle (C8, 3.9): downloads the file at an address the site's code names, on the
   * person's click only, and stores it in the open site's file, if it is still the opening
   * `sessionId` names. The renderer then keeps it in the site's code, as one undo step.
   */
  readonly bundleFile: {
    readonly channel: "site:bundle-file";
    readonly request: z.ZodTuple<[z.ZodUUID, z.ZodString], null>;
    readonly response: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            status: z.ZodLiteral<"bundled">;
            files: z.ZodArray<
              z.ZodType<
                import("@webforge/model").BundledFile,
                unknown,
                z.core.$ZodTypeInternals<import("@webforge/model").BundledFile, unknown>
              >
            >;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"failed">;
            reason: z.ZodEnum<{
              local: "local";
              "no-site": "no-site";
              "not-a-file": "not-a-file";
              "not-found": "not-found";
              "not-https": "not-https";
              offline: "offline";
              "read-only": "read-only";
              "stale-session": "stale-session";
              "too-large": "too-large";
              unknown: "unknown";
            }>;
          },
          z.core.$strict
        >,
      ],
      "status"
    >;
  };
};
/** Messages the main process sends to the renderer in the `site` domain. */
export declare const siteEvents: {
  /** How far export `operationId` has come. */
  readonly exportProgress: {
    readonly channel: "site:export-progress";
    readonly args: z.ZodTuple<
      [
        z.ZodUUID,
        z.ZodDiscriminatedUnion<
          [
            z.ZodObject<
              {
                stage: z.ZodEnum<{
                  images: "images";
                  pages: "pages";
                }>;
                done: z.ZodInt;
                total: z.ZodInt;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                stage: z.ZodEnum<{
                  fonts: "fonts";
                  styles: "styles";
                  writing: "writing";
                }>;
              },
              z.core.$strict
            >,
          ],
          "stage"
        >,
      ],
      null
    >;
  };
};
/** `window.webforge.site`. */
export interface SiteApi {
  /**
   * Shows a folder or save dialog, then builds the site opened as `sessionId` and writes it there,
   * as operation `operationId` (a new UUID for each export).
   */
  export(sessionId: string, request: ExportRequest, operationId: string): Promise<ExportResult>;
  /** What the person chose for the last export of the site opened as `sessionId`. */
  exportChoices(sessionId: string): Promise<ExportChoices>;
  /** Remembers the person's export choices with the site opened as `sessionId`. */
  setExportChoices(sessionId: string, choices: ExportChoices): Promise<null>;
  /** Opens the last export of the site opened as `sessionId` from disk. */
  openExport(sessionId: string): Promise<"opened" | "none" | "missing">;
  /** Shows the last export of the site opened as `sessionId` in the file manager. */
  showExport(sessionId: string): Promise<"opened" | "none" | "missing">;
  /** Cancels export `operationId`, if it is under way. */
  cancelExport(operationId: string): Promise<null>;
  /** Downloads the file at `url` to keep with the site opened as `sessionId`. */
  bundleFile(sessionId: string, url: string): Promise<BundleResult>;
  /** Tells `listener` how far each export comes, by its operation, until the returned function is called. */
  onExportProgress(listener: (operationId: string, progress: ExportProgress) => void): () => void;
}
//# sourceMappingURL=site.d.ts.map
