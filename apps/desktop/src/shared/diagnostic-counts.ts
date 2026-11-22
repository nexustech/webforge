/*
 * Help › Diagnostics…'s counts by name (5.41, BD-2), apart from the IPC contract so main's start-up
 * doesn't load them (#892): the renderer and main's diagnostics code, loaded when first used, do.
 */

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

/** One of {@link DIAGNOSTIC_TIMINGS}. */
export type DiagnosticTiming = (typeof DIAGNOSTIC_TIMINGS)[number];

/** Whether `field`, as IPC carries it, is one of {@link DIAGNOSTIC_COUNTS}. */
export const isDiagnosticCount = (field: string): field is DiagnosticCount =>
  (DIAGNOSTIC_COUNTS as readonly string[]).includes(field);

/** Whether `field`, as IPC carries it, is one of {@link DIAGNOSTIC_TIMINGS}. */
export const isDiagnosticTiming = (field: string): field is DiagnosticTiming =>
  (DIAGNOSTIC_TIMINGS as readonly string[]).includes(field);
