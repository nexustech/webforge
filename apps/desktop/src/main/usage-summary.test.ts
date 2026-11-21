import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { Socket } from "node:net";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createUsageSummary,
  listedOr,
  USAGE_FILE,
  type UsageComputer,
  type UsageLists,
  type UsageSummaryData,
  usageSummarySchema,
  versionNumbers,
} from "./usage-summary.js";

const tempDir = tempDirFactory();

const LISTS: UsageLists = {
  components: ["Hero", "Pricing"],
  rules: ["alt-text", "contrast"],
  tools: ["addNode", "listPages"],
};

const COMPUTER: UsageComputer = {
  version: [0, 3, 0],
  channel: "beta",
  platform: "win32",
  arch: "x64",
  osVersion: [10, 0, 26100],
  memoryGb: 16,
  scale: 1.5,
  language: "en",
};

/** A summary in `dir` whose writes wait for `flush`, with ids `install-1`, `install-2`… as UUIDs. */
function summaryIn(dir: string, options: { readonly crashReports?: () => number } = {}) {
  const writes: (() => void)[] = [];
  let ids = 0;
  const summary = createUsageSummary({
    dir,
    lists: async () => LISTS,
    computer: () => COMPUTER,
    newId: () => `00000000-0000-4000-8000-${String(++ids).padStart(12, "0")}`,
    now: () => Date.UTC(2026, 10, 21, 9),
    later: (write) => writes.push(write),
    ...options,
  });
  /** Runs the writes waiting, then waits for them. */
  const flush = async () => {
    for (const write of writes.splice(0)) write();
    await summary.idle();
  };
  return { summary, flush, writes };
}

const fileIn = (dir: string): UsageSummaryData =>
  JSON.parse(readFileSync(join(dir, USAGE_FILE), "utf8"));

type Def = { readonly type: string } & Record<string, unknown>;
const defOf = (schema: unknown) => (schema as { _zod: { def: Def } })._zod.def;

/**
 * Where `schema` takes text that isn't one of a fixed list: any string but the install's UUID, or
 * a kind of value this walk doesn't know (so a new kind is looked at, not let through).
 */
function freeText(schema: unknown, path = "summary"): string[] {
  const def = defOf(schema);
  switch (def.type) {
    case "string":
      return def.format === "uuid" ? [] : [path];
    case "enum":
    case "literal":
    case "number":
    case "boolean":
      return [];
    case "object":
      return Object.entries(def.shape as Record<string, unknown>).flatMap(([key, value]) =>
        freeText(value, `${path}.${key}`),
      );
    case "record":
      return [...freeText(def.keyType, `${path}[key]`), ...freeText(def.valueType, `${path}[]`)];
    case "array":
      return freeText(def.element, `${path}[]`);
    case "optional":
    case "nullable":
      return freeText(def.innerType, path);
    case "union":
      return (def.options as unknown[]).flatMap((option) => freeText(option, path));
    default:
      return [`${path} (${def.type})`];
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the usage summary's schema (BD-1)", () => {
  it("takes only numbers, times and names from fixed lists: no place for free text", () => {
    expect(freeText(usageSummarySchema(LISTS))).toEqual([]);
  });

  it("would be caught with a field of free text added", () => {
    const withNote = usageSummarySchema(LISTS).extend({ note: z.string().optional() });
    expect(freeText(withNote)).toEqual(["summary.note"]);
    const withNamedCounts = usageSummarySchema(LISTS).extend({
      pages: z.record(z.string(), z.int()),
    });
    expect(freeText(withNamedCounts)).toEqual(["summary.pages[key]"]);
  });

  it("refuses a name that isn't on its list", () => {
    const schema = usageSummarySchema(LISTS);
    const summary = schema.parse({
      ...JSON.parse(JSON.stringify(emptyFor())),
      used: { commands: { "edit.undo": 2 }, added: { Hero: 1 } },
    });
    expect(summary.used.commands).toEqual({ "edit.undo": 2 });
    expect(
      schema.safeParse({ ...summary, used: { commands: {}, added: { "Rosa's menu": 1 } } }).success,
    ).toBe(false);
  });
});

/** An empty summary, as a file holds it. */
function emptyFor(): UsageSummaryData {
  return usageSummarySchema(LISTS).parse({
    version: 1,
    installId: "00000000-0000-4000-8000-000000000001",
    since: 0,
    saved: 0,
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
  });
}

describe("createUsageSummary", () => {
  it("counts what happens, by listed name, and nothing it doesn't list", async () => {
    const dir = tempDir();
    const { summary, flush } = summaryIn(dir, { crashReports: () => 3 });
    await summary.start();
    summary.record({ kind: "siteStarted", how: "quickStart", template: "cafe" });
    summary.record({ kind: "firstEdit" });
    summary.record({ kind: "command", id: "edit.undo" });
    summary.record({ kind: "command", id: "edit.undo" });
    summary.record({ kind: "added", type: "Hero" });
    summary.record({ kind: "added", type: "Unlisted" });
    summary.record({ kind: "added", type: "shared" });
    summary.record({
      kind: "siteCheck",
      found: [
        { rule: "alt-text", level: "should" },
        { rule: "made-up", level: "must" },
      ],
    });
    summary.record({ kind: "quickStart", outcome: "cancelled", step: "pages" });
    summary.record({ kind: "tour", outcome: "taken" });
    summary.record({ kind: "tour", outcome: "closed", step: 2 });
    summary.record({ kind: "exported", ms: 812.4, pages: 6, pictures: 14 });
    summary.record({ kind: "exportFailed", reason: "write-failed" });
    summary.record({ kind: "published", host: "sftp" });
    summary.record({ kind: "publishFailed", reason: "unauthorized" });
    summary.record({ kind: "saveFailed", reason: "read-only" });
    summary.record({ kind: "filesFailed", reasons: ["too-large", "too-large"] });
    summary.record({ kind: "aiApp", app: "claude", tool: "addNode", outcome: "done" });
    summary.record({ kind: "aiApp", app: "other", tool: "secret", outcome: "declined" });
    summary.record({ kind: "assistant", outcome: "limit-reached" });
    summary.record({ kind: "assistantTool", tool: "listPages", state: "done" });
    summary.record({ kind: "preview", on: "phone", ms: 300, pages: 6, pictures: 14 });
    summary.record({ kind: "previewFailed" });
    summary.record({ kind: "siteOpened", ms: 120 });
    summary.record({ kind: "startup", ms: 1400 });
    await flush();

    const file = fileIn(dir);
    expect(file).toMatchObject({
      installId: "00000000-0000-4000-8000-000000000001",
      computer: COMPUTER,
      sites: {
        started: { quickStart: 1 },
        templates: { cafe: 1 },
        firstEdits: 1,
        siteChecks: 1,
        exports: 1,
        phonePreviews: 1,
        published: { sftp: 1 },
      },
      quickStart: { cancelled: { pages: 1 } },
      tour: { taken: 1, closedAt: [0, 0, 1] },
      used: { commands: { "edit.undo": 2 }, added: { Hero: 1, shared: 1 } },
      failures: {
        export: { "write-failed": 1 },
        publish: { unauthorized: 1 },
        save: { "read-only": 1 },
        files: { "too-large": 2 },
        previews: 1,
        crashReports: 3,
      },
      siteCheck: { must: {}, should: { "alt-text": 1 } },
      aiApps: {
        apps: { claude: 1, other: 1 },
        tools: { addNode: 1 },
        outcomes: { done: 1, declined: 1 },
      },
      assistant: { messages: { "limit-reached": 1 }, tools: { listPages: 1 } },
    });
    expect(file.timings.export).toEqual([
      { at: Date.UTC(2026, 10, 21, 9), ms: 812, pages: 6, pictures: 14 },
    ]);
    expect(file.timings.startup).toEqual([{ at: Date.UTC(2026, 10, 21, 9), ms: 1400 }]);
    expect(JSON.stringify(file)).not.toMatch(/Unlisted|made-up|secret/);
  });

  it("counts what was recorded before it started", async () => {
    const dir = tempDir();
    const { summary, flush } = summaryIn(dir);
    summary.record({ kind: "startup", ms: 900 });
    await summary.start();
    await flush();

    expect(fileIn(dir).timings.startup).toHaveLength(1);
  });

  it("is written in batches: one write for many events, not one each", async () => {
    const dir = tempDir();
    const { summary, flush, writes } = summaryIn(dir);
    await summary.start();
    await flush();
    for (let n = 0; n < 200; n++) summary.record({ kind: "command", id: "edit.undo" });

    expect(writes).toHaveLength(1);
    await flush();
    expect(fileIn(dir).used.commands).toEqual({ "edit.undo": 200 });
  });

  it("keeps the newest 50 of each timing", async () => {
    const dir = tempDir();
    const { summary, flush } = summaryIn(dir);
    await summary.start();
    for (let ms = 0; ms < 60; ms++) summary.record({ kind: "siteOpened", ms });
    await flush();

    const opened = fileIn(dir).timings.openSite;
    expect(opened).toHaveLength(50);
    expect(opened[0]?.ms).toBe(10);
  });

  it("survives a restart, or an update, with its counts and its install number", async () => {
    const dir = tempDir();
    const first = summaryIn(dir);
    await first.summary.start();
    first.summary.record({ kind: "command", id: "site.export" });
    await first.flush();

    const next = summaryIn(dir);
    await next.summary.start();
    next.summary.record({ kind: "command", id: "site.export" });
    await next.flush();

    expect(fileIn(dir)).toMatchObject({
      installId: "00000000-0000-4000-8000-000000000001",
      used: { commands: { "site.export": 2 } },
    });
  });

  it("sets a file that fails its schema aside and begins a new one, never counting from it", async () => {
    const dir = tempDir();
    const damaged = { ...emptyFor(), used: { commands: { "edit.undo": 7 }, added: {} }, note: "x" };
    writeFileSync(join(dir, USAGE_FILE), JSON.stringify(damaged));
    const { summary, flush } = summaryIn(dir);
    await summary.start();
    await flush();

    expect(fileIn(dir).used.commands).toEqual({});
    expect(readdirSync(dir).filter((name) => name.includes(".damaged-"))).toHaveLength(1);
  });

  it("Clear removes everything it holds and makes a new install number (BD-2, BD-5)", async () => {
    const dir = tempDir();
    const { summary, flush } = summaryIn(dir);
    await summary.start();
    summary.record({ kind: "command", id: "edit.undo" });
    summary.record({ kind: "startup", ms: 1200 });
    await flush();
    const before = fileIn(dir);
    expect(before.used.commands).toEqual({ "edit.undo": 1 });

    await summary.clear();
    const after = fileIn(dir);

    expect(after.installId).not.toBe(before.installId);
    expect(after.used.commands).toEqual({});
    expect(after.timings.startup).toEqual([]);
    expect(await summary.read()).toEqual(after);
  });

  it("makes no network request (BD-1: nothing is ever sent)", async () => {
    const fetched = vi.spyOn(globalThis, "fetch");
    const connected = vi.spyOn(Socket.prototype, "connect");
    const dir = tempDir();
    const { summary, flush } = summaryIn(dir);
    await summary.start();
    summary.record({ kind: "published", host: "netlify" });
    await flush();
    await summary.clear();

    expect(fetched).not.toHaveBeenCalled();
    expect(connected).not.toHaveBeenCalled();
  });
});

describe("the computer's numbers", () => {
  it("reads a version as numbers, and a name not listed as other", () => {
    expect(versionNumbers("0.3.0-beta.2")).toEqual([0, 3, 0]);
    expect(versionNumbers("6.5.0-1025-azure")).toEqual([6, 5, 0]);
    expect(versionNumbers("10.0.26100")).toEqual([10, 0, 26100]);
    expect(versionNumbers("rosa")).toEqual([]);
    expect(listedOr(["x64", "arm64"], "arm64")).toBe("arm64");
    expect(listedOr(["x64", "arm64"], "ppc64")).toBe("other");
  });
});
