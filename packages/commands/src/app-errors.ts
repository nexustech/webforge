import { z } from "zod";

/** Zod's own English words for a problem. */
const english = z.locales.en().localeError;

/**
 * The words for a problem in what an AI app sent (#1369): never the editor's form words, which the
 * renderer sets for every schema ("Fill this in.", `form-messages.ts`) and which tell an app
 * nothing. A missing value says what it should be, and `z.prettifyError` adds where; anything
 * else is zod's own English. A schema's own message still wins over these.
 */
const forApps: z.core.$ZodErrorMap = (issue) =>
  issue.code === "invalid_type" && issue.input === undefined
    ? `Missing: give a value here (expected ${issue.expected})`
    : english(issue);

/** The options every check of an AI app's input parses with: its problems worded for the app. */
export const APP_PARSE = { error: forApps } as const;
