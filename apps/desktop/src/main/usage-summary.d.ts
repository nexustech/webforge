import { z } from "zod";
import { type JsonStoreFiles } from "./json-store.js";
import { type UsageEvent } from "./usage.js";
/** The summary's file, in the app's user data beside the crash reports. */
export declare const USAGE_FILE = "usage-summary.json";
/** The names the summary counts that only load with a site's code, after start-up (#892). */
export type UsageLists = {
  /** The catalogue's component types (`Hero`). */
  readonly components: readonly string[];
  /** Site Check's rule ids. */
  readonly rules: readonly string[];
  /** The command layer's tool names, as AI apps and the Assistant call them. */
  readonly tools: readonly string[];
};
/** The lists, from the packages that hold them: loaded once the window has opened. */
export declare function loadUsageLists(): Promise<UsageLists>;
/** A version as numbers, at most four: `10.0.26100-generic` is `[10, 0, 26100]`. */
export declare function versionNumbers(version: string): number[];
/** `value` if `list` has it, else `other`. */
export declare const listedOr: <T extends string>(list: readonly T[], value: string) => T | "other";
/** The computer the summary was kept on, in numbers and listed names only. */
declare const computerSchema: z.ZodObject<
  {
    version: z.ZodArray<z.ZodInt>;
    channel: z.ZodEnum<{
      beta: "beta";
      stable: "stable";
    }>;
    platform: z.ZodEnum<{
      darwin: "darwin";
      linux: "linux";
      other: "other";
      win32: "win32";
    }>;
    arch: z.ZodEnum<{
      arm64: "arm64";
      other: "other";
      x64: "x64";
    }>;
    osVersion: z.ZodArray<z.ZodInt>;
    memoryGb: z.ZodInt;
    scale: z.ZodNumber;
    language: z.ZodEnum<{
      en: "en";
    }>;
  },
  z.core.$strict
>;
/** The computer the summary was kept on. */
export type UsageComputer = z.infer<typeof computerSchema>;
/** The summary's schema, with `lists`' names: what it may hold, and nothing else. */
export declare function usageSummarySchema(lists: UsageLists): z.ZodObject<
  {
    version: z.ZodLiteral<1>;
    installId: z.ZodUUID;
    since: z.ZodInt;
    saved: z.ZodInt;
    computer: z.ZodOptional<
      z.ZodObject<
        {
          version: z.ZodArray<z.ZodInt>;
          channel: z.ZodEnum<{
            beta: "beta";
            stable: "stable";
          }>;
          platform: z.ZodEnum<{
            darwin: "darwin";
            linux: "linux";
            other: "other";
            win32: "win32";
          }>;
          arch: z.ZodEnum<{
            arm64: "arm64";
            other: "other";
            x64: "x64";
          }>;
          osVersion: z.ZodArray<z.ZodInt>;
          memoryGb: z.ZodInt;
          scale: z.ZodNumber;
          language: z.ZodEnum<{
            en: "en";
          }>;
        },
        z.core.$strict
      >
    >;
    sites: z.ZodObject<
      {
        started: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
        templates: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
        firstEdits: z.ZodInt;
        siteChecks: z.ZodInt;
        previews: z.ZodInt;
        phonePreviews: z.ZodInt;
        exports: z.ZodInt;
        published: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
      },
      z.core.$strict
    >;
    quickStart: z.ZodObject<
      {
        created: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
        cancelled: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
      },
      z.core.$strict
    >;
    tour: z.ZodObject<
      {
        taken: z.ZodInt;
        declined: z.ZodInt;
        finished: z.ZodInt;
        closedAt: z.ZodArray<z.ZodInt>;
      },
      z.core.$strict
    >;
    used: z.ZodObject<
      {
        commands: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
        added: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
      },
      z.core.$strict
    >;
    failures: z.ZodObject<
      {
        export: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
        publish: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
        save: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
        files: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
        previews: z.ZodInt;
        crashReports: z.ZodInt;
      },
      z.core.$strict
    >;
    siteCheck: z.ZodObject<
      {
        must: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
        should: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
        tip: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
      },
      z.core.$strict
    >;
    aiApps: z.ZodObject<
      {
        apps: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
        tools: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
        outcomes: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
      },
      z.core.$strict
    >;
    assistant: z.ZodObject<
      {
        messages: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
        tools: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
        toolStates: z.ZodRecord<
          z.ZodEnum<{
            [x: string]: string;
          }> &
            z.core.$partial,
          z.ZodInt
        >;
      },
      z.core.$strict
    >;
    timings: z.ZodObject<
      {
        startup: z.ZodArray<
          z.ZodObject<
            {
              at: z.ZodInt;
              ms: z.ZodNumber;
              pages: z.ZodOptional<z.ZodInt>;
              pictures: z.ZodOptional<z.ZodInt>;
            },
            z.core.$strict
          >
        >;
        openSite: z.ZodArray<
          z.ZodObject<
            {
              at: z.ZodInt;
              ms: z.ZodNumber;
              pages: z.ZodOptional<z.ZodInt>;
              pictures: z.ZodOptional<z.ZodInt>;
            },
            z.core.$strict
          >
        >;
        export: z.ZodArray<
          z.ZodObject<
            {
              at: z.ZodInt;
              ms: z.ZodNumber;
              pages: z.ZodOptional<z.ZodInt>;
              pictures: z.ZodOptional<z.ZodInt>;
            },
            z.core.$strict
          >
        >;
        preview: z.ZodArray<
          z.ZodObject<
            {
              at: z.ZodInt;
              ms: z.ZodNumber;
              pages: z.ZodOptional<z.ZodInt>;
              pictures: z.ZodOptional<z.ZodInt>;
            },
            z.core.$strict
          >
        >;
      },
      z.core.$strict
    >;
  },
  z.core.$strict
>;
/** What the usage summary holds. */
export type UsageSummaryData = z.infer<ReturnType<typeof usageSummarySchema>>;
/** The usage summary: counts what happens, writes it now and then, and clears it. */
export type UsageSummary = {
  /** Reads the file (or begins a new one) and counts what was recorded before. */
  start(): Promise<void>;
  /** Counts `event`; written within a while, with what came before it. */
  record(event: UsageEvent): void;
  /** What it holds now: for the Diagnostics window (5.41). */
  read(): Promise<UsageSummaryData>;
  /** Removes everything it holds and makes a new install number (BD-2's Clear, BD-5). */
  clear(): Promise<void>;
  /** Writes what is waiting, and resolves once every write is done: before Webforge exits. */
  idle(): Promise<void>;
};
/**
 * The usage summary in `dir` (the app's user data): written from the main process only, batched
 * (at most every {@link WRITE_AFTER_MS}, and as Webforge exits), checked against its schema
 * whenever it is read or written. A file that fails it is set aside and a new one begun, never read
 * into the counts.
 */
export declare function createUsageSummary(options: {
  readonly dir: string;
  readonly lists: () => Promise<UsageLists>;
  readonly computer?: () => UsageComputer;
  /** How many crash reports the folder holds now. */
  readonly crashReports?: () => number;
  readonly now?: () => number;
  readonly newId?: () => string;
  readonly files?: JsonStoreFiles;
  /** Runs `write` after `ms`; a timer that doesn't keep Webforge open, but in tests. */
  readonly later?: (write: () => void, ms: number) => void;
}): UsageSummary;
//# sourceMappingURL=usage-summary.d.ts.map
