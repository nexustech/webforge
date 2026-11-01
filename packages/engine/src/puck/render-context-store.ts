import { sameJson } from "@webforge/model";
import type { RenderContext } from "@webforge/site-components";
import { isValidElement } from "react";
import type { Unsubscribe } from "../canvas-engine.js";

/**
 * What the canvas's components render with (#727): read by each as it draws, and followed by each
 * for the parts it read, so a change draws only the components that read what changed. Puck's
 * config never changes with it.
 */
export type RenderContextSource = {
  get(): RenderContext;
  /** Calls `listener` after each change. */
  subscribe(listener: () => void): Unsubscribe;
};

/** A {@link RenderContextSource} the engine changes. */
export type RenderContextStore = RenderContextSource & { set(next: RenderContext): void };

/** A new {@link RenderContextStore}, holding `initial`. */
export function createRenderContextStore(initial: RenderContext): RenderContextStore {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(next) {
      if (next === current) return;
      current = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** A context that never changes, from `get` as it is when read: for tests and static rendering. */
export function fixedRenderContext(get: () => RenderContext): RenderContextSource {
  return { get, subscribe: () => () => undefined };
}

/** One thing a component read of the context, with what it gave. */
type Read =
  | { readonly kind: "value"; readonly key: string; readonly value: unknown }
  | {
      readonly kind: "entry";
      readonly key: string;
      readonly entry: string;
      readonly value: unknown;
    }
  | {
      readonly kind: "call";
      readonly key: string;
      readonly fn: unknown;
      readonly args: readonly unknown[];
      readonly result: unknown;
    }
  | { readonly kind: "all" };

/** A plain object of the context, whose entries are followed one by one (`looks`, `previews`). */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value) && !isValidElement(value);

/** Whether a function's result `before` still holds as `after`: data compared as JSON. */
function sameResult(before: unknown, after: unknown): boolean {
  if (Object.is(before, after)) return true;
  // What draws something (a hint) or does something can't be compared: it counts as changed.
  const drawn = (value: unknown) => typeof value === "function" || isValidElement(value);
  if (drawn(before) || drawn(after)) return false;
  return sameJson(before, after);
}

/** Whether `read` gives something else in `context`. */
function changes(read: Read, context: RenderContext): boolean {
  const source = context as unknown as Readonly<Record<string, unknown>>;
  switch (read.kind) {
    case "all":
      return true;
    case "value":
      return !Object.is(source[read.key], read.value);
    case "entry": {
      const holder = source[read.key];
      return !Object.is(isRecord(holder) ? holder[read.entry] : undefined, read.value);
    }
    case "call": {
      const fn = source[read.key];
      if (Object.is(fn, read.fn)) return false;
      if (typeof fn !== "function") return true;
      return !sameResult(read.result, (fn as (...args: unknown[]) => unknown)(...read.args));
    }
  }
}

/**
 * What one component on the canvas read of the context as it last drew, and whether a change
 * reaches it. Made once per component (`useState`), and read through `useSyncExternalStore`:
 * {@link snapshot} changes only when something the component read gives something else.
 */
export type ContextTracker = {
  subscribe(listener: () => void): Unsubscribe;
  snapshot(): number;
  /**
   * The context for one drawing, which records each read: a value, an entry of a plain object
   * (the look of one kind), or a function's result for its arguments. The reads of the drawing
   * before are forgotten. What the component's own children read of it counts too.
   */
  track(): RenderContext;
};

/** A new {@link ContextTracker} following `source`. */
export function createContextTracker(source: RenderContextSource): ContextTracker {
  let reads: Read[] = [];
  let seen = source.get();
  let version = 0;
  const record = (read: Read, into: Read[]) => {
    into.push(read);
  };
  const entries = (key: string, holder: Readonly<Record<string, unknown>>, into: Read[]) =>
    new Proxy(holder, {
      get(target, entry, receiver) {
        const value: unknown = Reflect.get(target, entry, receiver);
        if (typeof entry === "string") record({ kind: "entry", key, entry, value }, into);
        return value;
      },
      // Read whole (its keys listed, spread): any change to it counts.
      ownKeys(target) {
        record({ kind: "value", key, value: holder }, into);
        return Reflect.ownKeys(target);
      },
      has(target, entry) {
        record({ kind: "value", key, value: holder }, into);
        return Reflect.has(target, entry);
      },
    });
  return {
    subscribe: (listener) =>
      source.subscribe(() => {
        const now = source.get();
        if (now === seen) return;
        seen = now;
        if (reads.some((read) => changes(read, now))) {
          version += 1;
          listener();
        }
      }),
    snapshot: () => version,
    track() {
      const context = source.get();
      seen = context;
      const into: Read[] = [];
      reads = into;
      // A copy: a proxy may hand out another value (a function's recorder) only for a property
      // that isn't frozen, and the context may be.
      const fields: Record<string, unknown> = { ...context };
      return new Proxy(fields, {
        get(target, key, receiver) {
          const value: unknown = Reflect.get(target, key, receiver);
          if (typeof key !== "string") return value;
          if (typeof value === "function") {
            return (...args: unknown[]) => {
              const result: unknown = (value as (...given: unknown[]) => unknown)(...args);
              record({ kind: "call", key, fn: value, args, result }, into);
              return result;
            };
          }
          if (isRecord(value)) return entries(key, value, into);
          record({ kind: "value", key, value }, into);
          return value;
        },
        ownKeys(target) {
          record({ kind: "all" }, into);
          return Reflect.ownKeys(target);
        },
        has(target, key) {
          record({ kind: "all" }, into);
          return Reflect.has(target, key);
        },
      }) as unknown as RenderContext;
    },
  };
}
