import { z } from "zod";

/** A listed name, as the summary holds it: a command's id, a rule's, an error's code. */
const listedName = z.string().regex(/^[A-Za-z0-9_.:-]{1,64}$/);

/**
 * The usage summary as the Diagnostics window shows it (5.41, BD-2), as IPC carries it: in main's
 * start-up, so its fields are checked by their shape, not listed (#892): main's summary flattened into
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
        /** One of `DIAGNOSTIC_COUNTS` (`diagnostic-counts.ts`), which main's start-up doesn't load. */
        field: z.string().regex(/^[a-z][A-Za-z]*\.[a-z][A-Za-z]*$/),
        /** The listed name a count is by; none for a count of its own. */
        name: listedName.optional(),
        count: z.int().nonnegative(),
      }),
    )
    .max(5000),
  timings: z
    .array(
      z.strictObject({
        /** One of `DIAGNOSTIC_TIMINGS`. */
        field: z.string().regex(/^[a-z][A-Za-z]*$/),
        samples: z.int().nonnegative(),
        medianMs: z.int().nonnegative(),
      }),
    )
    .max(8),
});

/** See {@link diagnosticsSchema}. */
export type Diagnostics = z.infer<typeof diagnosticsSchema>;

/** What became of saving the report. */
export const diagnosticsSavedSchema = z.enum(["saved", "cancelled", "failed"]);
