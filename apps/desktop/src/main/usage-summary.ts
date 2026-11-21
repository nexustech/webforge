import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { TEMPLATE_IDS } from "@webforge/templates";
import { z } from "zod";
import { AI_CLIENT_IDS } from "../shared/ai-clients/index.js";
import { ASSISTANT_ERRORS } from "../shared/ipc/assistant.js";
import { COMMIT_FAILURES } from "../shared/ipc/project.js";
import { PUBLISH_FAILURE_REASONS } from "../shared/ipc/publish.js";
import { EXPORT_FAILURES } from "../shared/ipc/site.js";
import { updateChannelSchema } from "../shared/update-channel.js";
import { QUICK_START_STEPS, TOUR_STEPS_MAX, USAGE_COMMANDS } from "../shared/usage.js";
import { createJsonStore, type JsonStoreFiles } from "./json-store.js";
import { logFailure } from "./log.js";
import {
  AI_OUTCOMES,
  ASSISTANT_TOOL_STATES,
  FILE_FAILURES,
  HOST_KINDS,
  SITE_STARTS,
  type UsageEvent,
} from "./usage.js";

// The usage summary (5.40, BD-1, BD-5, research/product/22 §4): counts and timings of how
// Webforge is used, kept beside the crash reports and never sent. It leaves the computer only when
// the person saves it and attaches it themselves (BD-2, BD-3). Its schema has no place for free
// text: every value is a number, a time, an install's random id, or a name from a fixed list in
// the code, so a site's words, names and addresses can't be written to it.

/** The summary's file, in the app's user data beside the crash reports. */
export const USAGE_FILE = "usage-summary.json";

/** How many of each timing the summary keeps: the newest. */
const SAMPLES_KEPT = 50;

/** How long after a change the summary is written, so events are batched, never one write each. */
const WRITE_AFTER_MS = 30_000;

/** The platforms and processors Webforge is built for; anything else is `other`. */
const PLATFORMS = ["win32", "darwin", "linux", "other"] as const;
const ARCHES = ["x64", "arm64", "other"] as const;

/** The languages the editor shows (only English so far): never a site's language. */
const EDITOR_LANGUAGES = ["en"] as const;

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
export async function loadUsageLists(): Promise<UsageLists> {
  const [{ CATALOGUE }, { SITE_CHECK_RULES }, { AI_TOOLS }] = await Promise.all([
    import("@webforge/site-components/catalogue-data"),
    import("@webforge/site-check"),
    import("@webforge/commands"),
  ]);
  return {
    components: Object.keys(CATALOGUE),
    rules: SITE_CHECK_RULES.map((rule) => rule.id),
    tools: AI_TOOLS.map((tool) => tool.name),
  };
}

/** A version as numbers, at most four: `10.0.26100-generic` is `[10, 0, 26100]`. */
export function versionNumbers(version: string): number[] {
  return (version.match(/^\d+(?:\.\d+){0,3}/)?.[0] ?? "")
    .split(".")
    .filter((part) => part !== "")
    .map(Number);
}

/** `value` if `list` has it, else `other`. */
export const listedOr = <T extends string>(list: readonly T[], value: string): T | "other" =>
  (list as readonly string[]).includes(value) ? (value as T) : "other";

const count = z.int().nonnegative();
const time = z.int().nonnegative();
/** A count for each of `names`, only those counted. */
const counts = (names: readonly string[]) =>
  z.partialRecord(z.enum(names as [string, ...string[]]), count);
/** The newest timings of one kind: when, how long, and how big. */
const samples = z
  .array(
    z.strictObject({
      at: time,
      ms: z.number().nonnegative().max(86_400_000),
      pages: count.optional(),
      pictures: count.optional(),
    }),
  )
  .max(SAMPLES_KEPT);

/** The computer the summary was kept on, in numbers and listed names only. */
const computerSchema = z.strictObject({
  /** Webforge's version as numbers: `0.3.0` is `[0, 3, 0]`. */
  version: z.array(count).max(4),
  channel: updateChannelSchema,
  platform: z.enum(PLATFORMS),
  arch: z.enum(ARCHES),
  /** The operating system's version as numbers: Windows 11's `10.0.26100` is `[10, 0, 26100]`. */
  osVersion: z.array(count).max(4),
  /** Memory, in whole GB. */
  memoryGb: count.max(4096),
  /** The main display's scale: 1, 1.5, 2. */
  scale: z.number().positive().max(8),
  language: z.enum(EDITOR_LANGUAGES),
});

/** The computer the summary was kept on. */
export type UsageComputer = z.infer<typeof computerSchema>;

/** The summary's schema, with `lists`' names: what it may hold, and nothing else. */
export function usageSummarySchema(lists: UsageLists) {
  return z.strictObject({
    version: z.literal(1),
    /** A random number for this install (BD-5): names nobody; Clear makes a new one. */
    installId: z.uuid(),
    /** When counting began: the first run, or the last Clear. */
    since: time,
    /** When it was last written. */
    saved: time,
    computer: computerSchema.optional(),
    /** The path to a finished site (§2's first question). */
    sites: z.strictObject({
      started: counts(SITE_STARTS),
      templates: counts(TEMPLATE_IDS),
      firstEdits: count,
      siteChecks: count,
      previews: count,
      phonePreviews: count,
      exports: count,
      published: counts(HOST_KINDS),
    }),
    /** Where the quick start ended, by step. */
    quickStart: z.strictObject({
      created: counts(QUICK_START_STEPS),
      cancelled: counts(QUICK_START_STEPS),
    }),
    /** The tour: taken, its offer turned down, finished, or closed at each step (by position). */
    tour: z.strictObject({
      taken: count,
      declined: count,
      finished: count,
      closedAt: z.array(count).max(TOUR_STEPS_MAX),
    }),
    /** What is used: each command, and each kind of section and element added. */
    used: z.strictObject({
      commands: counts(USAGE_COMMANDS),
      added: counts([...lists.components, "shared"]),
    }),
    /** What fails, by code; and how many crash reports the folder holds. */
    failures: z.strictObject({
      export: counts(EXPORT_FAILURES),
      publish: counts(PUBLISH_FAILURE_REASONS),
      save: counts(COMMIT_FAILURES),
      files: counts(FILE_FAILURES),
      previews: count,
      crashReports: count,
    }),
    /** How often each rule found something, by its level. */
    siteCheck: z.strictObject({
      must: counts(lists.rules),
      should: counts(lists.rules),
      tip: counts(lists.rules),
    }),
    /** AI apps: their requests, by the kind of app, the tool and what came of them. */
    aiApps: z.strictObject({
      apps: counts(AI_CLIENT_IDS),
      tools: counts(lists.tools),
      outcomes: counts(AI_OUTCOMES),
    }),
    /** The Assistant: messages, by what came of sending them, and its tool calls. */
    assistant: z.strictObject({
      messages: counts(["sending", ...ASSISTANT_ERRORS]),
      tools: counts(lists.tools),
      toolStates: counts(ASSISTANT_TOOL_STATES),
    }),
    /** How long things took, with the site's size (§2's fifth question). */
    timings: z.strictObject({
      startup: samples,
      openSite: samples,
      export: samples,
      preview: samples,
    }),
  });
}

/** What the usage summary holds. */
export type UsageSummaryData = z.infer<ReturnType<typeof usageSummarySchema>>;

/** A summary with nothing counted yet, for install `installId`, begun `at`. */
function emptyUsageSummary(installId: string, at: number): UsageSummaryData {
  return {
    version: 1,
    installId,
    since: at,
    saved: at,
    sites: {
      started: {},
      templates: {},
      firstEdits: 0,
      siteChecks: 0,
      previews: 0,
      phonePreviews: 0,
      exports: 0,
      published: {},
    },
    quickStart: { created: {}, cancelled: {} },
    tour: { taken: 0, declined: 0, finished: 0, closedAt: [] },
    used: { commands: {}, added: {} },
    failures: { export: {}, publish: {}, save: {}, files: {}, previews: 0, crashReports: 0 },
    siteCheck: { must: {}, should: {}, tip: {} },
    aiApps: { apps: {}, tools: {}, outcomes: {} },
    assistant: { messages: {}, tools: {}, toolStates: {} },
    timings: { startup: [], openSite: [], export: [], preview: [] },
  };
}

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

/** Adds one to `record[name]`, when `names` has it. */
function bump(record: Partial<Record<string, number>>, name: string, names: ReadonlySet<string>) {
  if (names.has(name)) record[name] = (record[name] ?? 0) + 1;
}

/**
 * The usage summary in `dir` (the app's user data): written from the main process only, batched
 * (at most every {@link WRITE_AFTER_MS}, and as Webforge exits), checked against its schema
 * whenever it is read or written. A file that fails it is set aside and a new one begun, never read
 * into the counts.
 */
export function createUsageSummary(options: {
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
}): UsageSummary {
  const now = options.now ?? Date.now;
  const newId = options.newId ?? randomUUID;
  const later =
    options.later ??
    ((write: () => void, ms: number) => {
      setTimeout(write, ms).unref?.();
    });
  const waiting: UsageEvent[] = [];
  let loaded:
    | {
        readonly schema: ReturnType<typeof usageSummarySchema>;
        readonly store: ReturnType<typeof createJsonStore<UsageSummaryData | null>>;
        readonly names: {
          readonly components: ReadonlySet<string>;
          readonly rules: ReadonlySet<string>;
          readonly tools: ReadonlySet<string>;
        };
      }
    | undefined;
  let current: UsageSummaryData | undefined;
  let starting: Promise<void> | undefined;
  let dirty = false;
  let scheduled = false;

  const COMMANDS = new Set(USAGE_COMMANDS);
  const TEMPLATES = new Set<string>(TEMPLATE_IDS);
  const STARTS = new Set<string>(SITE_STARTS);
  const HOSTS = new Set<string>(HOST_KINDS);
  const STEPS = new Set<string>(QUICK_START_STEPS);
  const EXPORT = new Set<string>(EXPORT_FAILURES);
  const PUBLISH = new Set<string>(PUBLISH_FAILURE_REASONS);
  const SAVE = new Set<string>(COMMIT_FAILURES);
  const FILES = new Set<string>(FILE_FAILURES);
  const APPS = new Set<string>(AI_CLIENT_IDS);
  const OUTCOMES = new Set<string>(AI_OUTCOMES);
  const MESSAGES = new Set<string>(["sending", ...ASSISTANT_ERRORS]);
  const TOOL_STATES = new Set<string>(ASSISTANT_TOOL_STATES);

  /** Keeps a timing, the newest {@link SAMPLES_KEPT}. */
  const timed = (
    list: UsageSummaryData["timings"]["startup"],
    ms: number,
    size?: { readonly pages: number; readonly pictures: number },
  ) => {
    list.push({
      at: now(),
      ms: Math.round(Math.min(Math.max(ms, 0), 86_400_000)),
      ...(size === undefined
        ? {}
        : {
            pages: Math.max(0, Math.round(size.pages)),
            pictures: Math.max(0, Math.round(size.pictures)),
          }),
    });
    if (list.length > SAMPLES_KEPT) list.splice(0, list.length - SAMPLES_KEPT);
  };

  /** Counts `event` in `summary`; a name its list doesn't have counts nothing. */
  const apply = (
    summary: UsageSummaryData,
    event: UsageEvent,
    names: NonNullable<typeof loaded>["names"],
  ) => {
    const { sites, failures } = summary;
    switch (event.kind) {
      case "command":
        bump(summary.used.commands, event.id, COMMANDS);
        return;
      case "added":
        if (event.type === "shared" || names.components.has(event.type)) {
          summary.used.added[event.type] = (summary.used.added[event.type] ?? 0) + 1;
        }
        return;
      case "siteCheck":
        sites.siteChecks += 1;
        for (const { rule, level } of event.found)
          bump(summary.siteCheck[level], rule, names.rules);
        return;
      case "quickStart":
        bump(summary.quickStart[event.outcome], event.step, STEPS);
        return;
      case "tour":
        if (event.outcome === "closed") {
          const step = event.step ?? 0;
          if (step < 0 || step >= TOUR_STEPS_MAX) return;
          const closedAt = summary.tour.closedAt;
          while (closedAt.length <= step) closedAt.push(0);
          closedAt[step] = (closedAt[step] ?? 0) + 1;
        } else summary.tour[event.outcome] += 1;
        return;
      case "siteStarted":
        bump(sites.started, event.how, STARTS);
        if (event.template !== undefined) bump(sites.templates, event.template, TEMPLATES);
        return;
      case "siteOpened":
        timed(summary.timings.openSite, event.ms);
        return;
      case "firstEdit":
        sites.firstEdits += 1;
        return;
      case "preview":
        if (event.on === "phone") sites.phonePreviews += 1;
        else sites.previews += 1;
        timed(summary.timings.preview, event.ms, event);
        return;
      case "previewFailed":
        failures.previews += 1;
        return;
      case "exported":
        sites.exports += 1;
        timed(summary.timings.export, event.ms, event);
        return;
      case "exportFailed":
        bump(failures.export, event.reason, EXPORT);
        return;
      case "published":
        bump(sites.published, event.host, HOSTS);
        return;
      case "publishFailed":
        bump(failures.publish, event.reason, PUBLISH);
        return;
      case "saveFailed":
        bump(failures.save, event.reason, SAVE);
        return;
      case "filesFailed":
        for (const reason of event.reasons) bump(failures.files, reason, FILES);
        return;
      case "aiApp":
        bump(summary.aiApps.apps, event.app, APPS);
        bump(summary.aiApps.tools, event.tool, names.tools);
        bump(summary.aiApps.outcomes, event.outcome, OUTCOMES);
        return;
      case "assistant":
        bump(summary.assistant.messages, event.outcome, MESSAGES);
        return;
      case "assistantTool":
        bump(summary.assistant.tools, event.tool, names.tools);
        bump(summary.assistant.toolStates, event.state, TOOL_STATES);
        return;
      case "startup":
        timed(summary.timings.startup, event.ms);
        return;
    }
  };

  /** Writes the summary, if anything changed, as its schema allows it. */
  const write = async () => {
    if (loaded === undefined || current === undefined || !dirty) return;
    dirty = false;
    const crashReports = options.crashReports?.();
    const next: UsageSummaryData = {
      ...current,
      saved: now(),
      ...(options.computer === undefined ? {} : { computer: options.computer() }),
      failures: {
        ...current.failures,
        ...(crashReports === undefined ? {} : { crashReports }),
      },
    };
    const checked = loaded.schema.safeParse(next);
    if (!checked.success) {
      // Never written: a value its schema refuses could be one that shouldn't be there.
      logFailure("Webforge could not keep the usage summary", new Error("invalid"));
      return;
    }
    current = checked.data;
    const value = current;
    await loaded.store.update(() => value);
  };

  /** Writes within {@link WRITE_AFTER_MS}, once, however many changes come before then. */
  const schedule = () => {
    dirty = true;
    if (scheduled) return;
    scheduled = true;
    later(() => {
      scheduled = false;
      void write().catch((error: unknown) =>
        logFailure("Webforge could not keep the usage summary", error),
      );
    }, WRITE_AFTER_MS);
  };

  const start = () => {
    starting ??= (async () => {
      const lists = await options.lists();
      const schema = usageSummarySchema(lists);
      const store = createJsonStore<UsageSummaryData | null>(
        join(options.dir, USAGE_FILE),
        schema.nullable(),
        // A file that fails its schema (damaged, or a newer build's) is kept aside, never counted.
        {
          empty: null,
          onDamaged: "move-aside",
          ...(options.files ? { files: options.files } : {}),
        },
      );
      loaded = {
        schema,
        store,
        names: {
          components: new Set(lists.components),
          rules: new Set(lists.rules),
          tools: new Set(lists.tools),
        },
      };
      let begun = false;
      await store.update((stored) => {
        begun = stored === null;
        current = stored ?? emptyUsageSummary(newId(), now());
        // A new one is written at once, setting a damaged file aside; a kept one waits for news.
        return begun ? current : undefined;
      });
      const names = loaded.names;
      const summary = current;
      if (summary === undefined) return;
      for (const event of waiting.splice(0)) apply(summary, event, names);
      // The computer as it is now, written with the next change.
      if (options.computer !== undefined || begun) schedule();
    })();
    return starting;
  };

  return {
    start,
    record(event) {
      if (loaded === undefined || current === undefined) {
        // Before the lists load: kept for then, a few hundred at most.
        if (waiting.length < 500) waiting.push(event);
        return;
      }
      apply(current, event, loaded.names);
      schedule();
    },
    async read() {
      await start();
      return structuredClone(current ?? emptyUsageSummary(newId(), now()));
    },
    async clear() {
      await start();
      current = emptyUsageSummary(newId(), now());
      dirty = true;
      await write();
    },
    async idle() {
      if (starting === undefined) return;
      await starting.catch(() => undefined);
      await write();
      await loaded?.store.idle();
    },
  };
}
