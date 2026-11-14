import { DEFAULT_THEME, type SiteSnapshot, siteSnapshotSchema, themeSchema } from "@webforge/model";
import { describe, expect, it } from "vitest";
import type { z } from "zod";

// The IPC contracts' test kit (#991). Every `shared/ipc` module's test runs `describeChannels` on its
// channels: for each, a request and a response made from its schemas round-trip, and the request
// refuses an argument too many, a wrong type and a string or list over its limit, and a strict
// object refuses a key it doesn't know. A sample the kit can't make (a pattern it can't meet) is
// given in `samples`; a channel left without one fails, naming the schema.

/** A zod schema's definition, as zod 4 keeps it: its kind, and what that kind has. */
type Def = {
  readonly type: string;
  readonly [key: string]: unknown;
};

/** A check on a string, number or list: its kind and its limit. */
type Check = {
  readonly check: string;
  readonly maximum?: number;
  readonly minimum?: number;
  readonly value?: number;
  readonly inclusive?: boolean;
  readonly format?: string;
  readonly pattern?: RegExp;
};

const defOf = (schema: z.ZodType): Def => (schema as unknown as { _zod: { def: Def } })._zod.def;
const checksOf = (def: Def): readonly Check[] =>
  ((def.checks as readonly { _zod: { def: Check } }[] | undefined) ?? []).map(
    (check) => check._zod.def,
  );
const limit = (checks: readonly Check[], kind: string, key: "maximum" | "minimum") =>
  checks.find((check) => check.check === kind)?.[key];

/** Strings a pattern is tried with, in order, for a string it can't otherwise make. */
const CANDIDATES = [
  "sample",
  "a",
  "A",
  "Sample",
  "a1",
  "1",
  "sample-1",
  "#ffffff",
  "en-GB",
  "https://example.com/",
  "a".repeat(64),
  "0".repeat(64),
  "0".repeat(32),
  "00000000-0000-4000-8000-000000000001",
  "index.html",
  "data:image/jpeg;base64,AAAA",
  "data:image/png;base64,AAAA",
];

/** A site as a snapshot carries it: one empty home page. */
const SNAPSHOT: SiteSnapshot = {
  name: "Bakery",
  language: "en",
  theme: DEFAULT_THEME,
  layout: { header: [], footer: [] },
  pages: [{ id: "home", path: "index", title: "Home", doc: { root: { props: {} }, content: [] } }],
  media: [],
};

/** Schemas too rich to make from their definitions, and a value each accepts. */
const KNOWN = new Map<z.ZodType, unknown>([
  [siteSnapshotSchema, SNAPSHOT],
  [themeSchema, DEFAULT_THEME],
]);

/** Values tried for a custom check, which says only whether it accepts one. */
const CUSTOM = [new Uint8Array(1), null, "sample", 1, {}];

/** A string `def` accepts, or undefined. */
function stringFor(def: Def): string | undefined {
  const checks = checksOf(def);
  const format = (def.format as string | undefined) ?? checks.find((c) => c.format)?.format;
  const formats: Readonly<Record<string, string>> = {
    uuid: "00000000-0000-4000-8000-000000000001",
    guid: "00000000-0000-4000-8000-000000000001",
    url: "https://example.com/",
    email: "rosa@example.com",
    date: "2026-11-14",
    datetime: "2026-11-14T10:00:00.000Z",
    time: "10:00:00",
  };
  if (format !== undefined && format !== "regex" && formats[format] !== undefined) {
    return formats[format];
  }
  const min = limit(checks, "min_length", "minimum") ?? 0;
  const max = limit(checks, "max_length", "maximum") ?? Number.POSITIVE_INFINITY;
  const pattern = checks.find((check) => check.format === "regex")?.pattern;
  const fits = (text: string) =>
    text.length >= min && text.length <= max && (pattern === undefined || pattern.test(text));
  const tried = [...CANDIDATES, "a".repeat(Math.max(min, 1))];
  return tried.find(fits);
}

/** A number `def` accepts. */
function numberFor(def: Def): number {
  const checks = checksOf(def);
  const above = checks.find((check) => check.check === "greater_than");
  const below = checks.find((check) => check.check === "less_than");
  let value = 1;
  if (above?.value !== undefined) value = above.inclusive ? above.value : above.value + 1;
  if (below?.value !== undefined && value > below.value) {
    value = below.inclusive ? below.value : below.value - 1;
  }
  return value;
}

/** Nothing a schema made: a field it may leave out. */
const OMIT = Symbol("omit");

/** Where the kit last couldn't make a value: a path into the schema, and its kind. */
let missing = "";

/** A value `schema` accepts, made from its definition; `undefined` when it can't make one. */
function make(schema: z.ZodType, path = ""): unknown {
  const made = makeAt(schema, path);
  if (made === undefined && missing === "") missing = `${path || "(top)"} (${defOf(schema).type})`;
  return made;
}

function makeAt(schema: z.ZodType, path: string): unknown {
  if (KNOWN.has(schema)) return structuredClone(KNOWN.get(schema));
  const def = defOf(schema);
  const inner = (key: string) => make(def[key] as z.ZodType, path);
  switch (def.type) {
    case "string":
      return stringFor(def);
    case "number":
    case "int":
      return numberFor(def);
    case "bigint":
      return 1n;
    case "boolean":
      return true;
    case "null":
      return null;
    case "undefined":
    case "void":
      return undefined;
    case "any":
    case "unknown":
      return null;
    case "literal":
      return (def.values as readonly unknown[])[0];
    case "enum":
      return Object.values(def.entries as Record<string, unknown>)[0];
    case "optional":
      return OMIT;
    case "nullable":
    case "default":
    case "prefault":
    case "readonly":
    case "catch":
    case "nonoptional":
      return inner("innerType");
    case "pipe":
      // A value prepared first (z.preprocess): what comes out of it is what the schema takes.
      return defOf(def.in as z.ZodType).type === "transform" ? inner("out") : inner("in");
    case "custom":
      return CUSTOM.find((value) => schema.safeParse(value).success);
    case "lazy":
      return make((def.getter as () => z.ZodType)(), path);
    case "object": {
      const shape = def.shape as Record<string, z.ZodType>;
      const value: Record<string, unknown> = {};
      for (const [key, member] of Object.entries(shape)) {
        const made = make(member, `${path}.${key}`);
        if (made === undefined && defOf(member).type !== "undefined") return undefined;
        if (made !== OMIT) value[key] = made;
      }
      return value;
    }
    case "array": {
      const checks = checksOf(def);
      const min = limit(checks, "min_length", "minimum") ?? 0;
      const max = limit(checks, "max_length", "maximum") ?? 1;
      const count = Math.max(min, Math.min(1, max));
      const element = make(def.element as z.ZodType, `${path}[]`);
      // One it can't make: none, where it may have none.
      if (element === undefined || element === OMIT) return min === 0 ? [] : undefined;
      return Array.from({ length: count }, () => structuredClone(element));
    }
    case "tuple": {
      // An optional argument left out keeps its place.
      const items = (def.items as z.ZodType[]).map((item, at) => make(item, `${path}[${at}]`));
      return items.includes(undefined)
        ? undefined
        : items.map((item) => (item === OMIT ? undefined : item));
    }
    case "union": {
      for (const option of def.options as z.ZodType[]) {
        const made = make(option, path);
        if (made !== undefined && option.safeParse(made).success) return made;
      }
      return undefined;
    }
    case "record":
      return {};
    case "intersection": {
      const left = inner("left");
      const right = inner("right");
      return typeof left === "object" && typeof right === "object"
        ? { ...(left as object), ...(right as object) }
        : undefined;
    }
    default:
      return undefined;
  }
}

/** A value a schema accepts, or where in it the kit couldn't make one. */
type Sample =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly where: string };

/** A value `schema` accepts, or why the kit can't make one. */
export function sampleOf(schema: z.ZodType): Sample {
  missing = "";
  const value = make(schema);
  if (value === undefined || value === OMIT) return { ok: false, where: missing };
  const parsed = schema.safeParse(value);
  if (parsed.success) return { ok: true, value };
  const issue = parsed.error.issues[0];
  return { ok: false, where: `${issue?.path.join(".") ?? ""}: ${issue?.message ?? ""}` };
}

/** `value` with its first string or list over the limit `schema` sets, or undefined if none has one. */
export function overLimit(schema: z.ZodType, value: unknown): unknown {
  const def = defOf(schema);
  switch (def.type) {
    case "string": {
      const max = limit(checksOf(def), "max_length", "maximum");
      return max === undefined || typeof value !== "string" ? undefined : "a".repeat(max + 1);
    }
    case "array": {
      const max = limit(checksOf(def), "max_length", "maximum");
      if (max !== undefined && Array.isArray(value) && value.length > 0) {
        return Array.from({ length: max + 1 }, () => value[0]);
      }
      if (!Array.isArray(value)) return undefined;
      for (const [index, item] of value.entries()) {
        const over = overLimit(def.element as z.ZodType, item);
        if (over !== undefined) return value.map((each, at) => (at === index ? over : each));
      }
      return undefined;
    }
    case "tuple":
      if (!Array.isArray(value)) return undefined;
      for (const [index, item] of (def.items as z.ZodType[]).entries()) {
        const over = overLimit(item, value[index]);
        if (over !== undefined) return value.map((each, at) => (at === index ? over : each));
      }
      return undefined;
    case "object":
      if (typeof value !== "object" || value === null) return undefined;
      for (const [key, member] of Object.entries(def.shape as Record<string, z.ZodType>)) {
        if (!(key in value)) continue;
        const over = overLimit(member, (value as Record<string, unknown>)[key]);
        if (over !== undefined) return { ...value, [key]: over };
      }
      return undefined;
    case "nullable":
    case "optional":
    case "default":
    case "readonly":
      return overLimit(def.innerType as z.ZodType, value);
    case "pipe":
      return overLimit(def.in as z.ZodType, value);
    case "union":
      for (const option of def.options as z.ZodType[]) {
        if (!option.safeParse(value).success) continue;
        const over = overLimit(option, value);
        if (over !== undefined) return over;
      }
      return undefined;
    default:
      return undefined;
  }
}

/** Whether `schema` takes anything at all as its first argument (so no type is wrong for it). */
const takesAnything = (schema: z.ZodType) =>
  ["any", "unknown", "custom"].includes(defOf(schema).type);

/** Whether `value`, an object `schema` accepts, would be refused with a key it doesn't know. */
const refusesUnknownKeys = (schema: z.ZodType, value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !schema.safeParse({ ...value, unknownKey: "sample" }).success;

/** Whether `schema` is a strict object, or a union of them, at its top. */
function isStrict(schema: z.ZodType): boolean {
  const def = defOf(schema);
  // A strict object has a catchall that takes nothing; a loose one has none.
  if (def.type === "object") {
    return def.catchall !== undefined && defOf(def.catchall as z.ZodType).type === "never";
  }
  if (def.type === "union") return (def.options as z.ZodType[]).every(isStrict);
  if (def.type === "nullable" || def.type === "optional")
    return isStrict(def.innerType as z.ZodType);
  return false;
}

/** A channel of a contract: its name, and the schemas its request and response are checked with. */
type Channel = {
  readonly channel: string;
  readonly request: z.ZodType;
  readonly response: z.ZodType;
};

/** A sample of a channel's request (its arguments) or response, for one the kit can't make. */
export type ChannelSamples = {
  readonly request?: readonly unknown[];
  readonly response?: unknown;
};

/**
 * Checks each of `channels`, a `shared/ipc` module's (`aiChannels`): a request and a response
 * round-trip; the request refuses an argument too many, a wrong type and a string or list over its
 * limit; and a strict object refuses a key it doesn't know. `samples` gives what the kit can't make.
 */
export function describeChannels<Channels extends Readonly<Record<string, Channel>>>(
  domain: string,
  channels: Channels,
  samples: { readonly [Name in keyof Channels]?: ChannelSamples } = {},
): void {
  describe(`the ${domain} IPC contract (#991)`, () => {
    for (const [name, { channel, request, response }] of Object.entries(channels)) {
      const given = samples[name as keyof Channels];
      const made: Sample =
        given?.request === undefined ? sampleOf(request) : { ok: true, value: given.request };
      const answer: Sample =
        given !== undefined && "response" in given
          ? { ok: true, value: given.response }
          : sampleOf(response);
      const where = (sample: Sample) => (sample.ok ? "" : sample.where);

      it(`${channel}: a request and an answer go through as they are`, () => {
        expect(made.ok, `${channel}'s request: give a sample (${where(made)})`).toBe(true);
        expect(answer.ok, `${channel}'s answer: give a sample (${where(answer)})`).toBe(true);
        if (!made.ok || !answer.ok) return;
        expect(request.safeParse(made.value).success, `${channel}'s request`).toBe(true);
        expect(response.safeParse(answer.value).success, `${channel}'s answer`).toBe(true);
      });

      it(`${channel}: refuses an argument too many, a wrong type and too much`, () => {
        if (!made.ok || !Array.isArray(made.value)) return;
        const values = made.value as unknown[];
        const items = defOf(request).items as z.ZodType[] | undefined;
        if (defOf(request).rest == null) {
          // After every argument it takes, optional ones too.
          const every = Array.from({ length: items?.length ?? 0 }, (_, at) => values[at]);
          expect(request.safeParse([...every, "extra"]).success, "an argument too many").toBe(
            false,
          );
        }
        const first = items?.[0];
        if (first !== undefined && !takesAnything(first)) {
          expect(
            request.safeParse([Symbol("wrong"), ...values.slice(1)]).success,
            "a wrong type",
          ).toBe(false);
        }
        const over = overLimit(request, values);
        if (over !== undefined) {
          expect(request.safeParse(over).success, "over its limit").toBe(false);
        }
      });

      if (answer.ok && isStrict(response)) {
        it(`${channel}: its answer refuses a key it doesn't know`, () => {
          expect(refusesUnknownKeys(response, answer.value)).toBe(true);
        });
      }
    }
  });
}
