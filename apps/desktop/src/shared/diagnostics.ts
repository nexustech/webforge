import { z } from "zod";

/**
 * Every count the usage summary holds (5.40, BD-1), by its section and field, as Help ›
 * Diagnostics… shows it (5.41, BD-2). Each has its wording in the catalogue
 * (`diagnostics.field.<count>`); main's flattening of the summary gives these and no others, which
 * a test of main's checks against the summary's own schema, so a count added to the summary
 * without wording fails.
 */
export const DIAGNOSTIC_COUNTS = [
  "sites.started",
  "sites.templates",
  "sites.firstEdits",
  "sites.siteChecks",
  "sites.previews",
  "sites.phonePreviews",
  "sites.exports",
  "sites.published",
  "quickStart.created",
  "quickStart.cancelled",
  "tour.taken",
  "tour.declined",
  "tour.finished",
  "tour.closedAt",
  "used.commands",
  "used.added",
  "failures.export",
  "failures.publish",
  "failures.save",
  "failures.files",
  "failures.previews",
  "failures.crashReports",
  "siteCheck.must",
  "siteCheck.should",
  "siteCheck.tip",
  "aiApps.apps",
  "aiApps.tools",
  "aiApps.outcomes",
  "assistant.messages",
  "assistant.tools",
  "assistant.toolStates",
] as const;

/** One of {@link DIAGNOSTIC_COUNTS}. */
export type DiagnosticCount = (typeof DIAGNOSTIC_COUNTS)[number];

/** The summary's timings, each a number of samples with their median. */
export const DIAGNOSTIC_TIMINGS = ["startup", "openSite", "export", "preview"] as const;

/** A listed name, as the summary holds it: a command's id, a rule's, an error's code. */
const listedName = z.string().regex(/^[A-Za-z0-9_.:-]{1,64}$/);

/**
 * The usage summary as the Diagnostics window shows it (5.41, BD-2): main's summary flattened into
 * rows, each a count by its field and, for a count by name, the listed name. Numbers and listed
 * names only, as the summary is: no free text can be in it.
 */
export const diagnosticsSchema = z.strictObject({
  /** A random number for this install (BD-5), which Clear makes again. */
  installId: z.uuid(),
  /** When counting began: the first run, or the last Clear. */
  since: z.int().nonnegative(),
  /** The computer, in words the window makes from numbers and listed names; none until known. */
  computer: z
    .strictObject({
      version: z.string().regex(/^\d+(\.\d+){0,3}$/),
      channel: listedName,
      platform: listedName,
      arch: listedName,
      osVersion: z.string().regex(/^(\d+(\.\d+){0,3})?$/),
      memoryGb: z.int().nonnegative().max(4096),
      scale: z.number().positive().max(8),
      language: listedName,
    })
    .nullable(),
  counts: z
    .array(
      z.strictObject({
        field: z.enum(DIAGNOSTIC_COUNTS),
        /** The listed name a count is by; none for a count of its own. */
        name: listedName.optional(),
        count: z.int().nonnegative(),
      }),
    )
    .max(5000),
  timings: z
    .array(
      z.strictObject({
        field: z.enum(DIAGNOSTIC_TIMINGS),
        samples: z.int().nonnegative(),
        medianMs: z.int().nonnegative(),
      }),
    )
    .max(DIAGNOSTIC_TIMINGS.length),
});

/** See {@link diagnosticsSchema}. */
export type Diagnostics = z.infer<typeof diagnosticsSchema>;

/** What became of saving the report. */
export const diagnosticsSavedSchema = z.enum(["saved", "cancelled", "failed"]);
