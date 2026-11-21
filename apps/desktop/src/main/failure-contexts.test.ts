import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { failureContextSchema } from "../shared/ipc/app.js";

// The renderer's handled failures reach main's log by a context `logFailure`'s schema takes
// (`clipboard.paste`); one it refuses is dropped, and the failure leaves no trace (#1285). Each
// context the editor's code names, as `reportFailure`'s first argument or one of the helpers that
// pass theirs on, must be one it takes.

const RENDERER = join(import.meta.dirname, "../renderer");

/** The renderer's source files, tests and stories left out. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.(test|stories)\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/**
 * The contexts in `text`: `reportFailure("…")`, a template's fixed start (`command.${id}` as
 * `command.x`), and the literal contexts the assistant's helpers and the build flows pass on.
 */
function contextsIn(text: string): string[] {
  const patterns = [
    /reportFailure\(\s*"([^"]*)"/g,
    // A template's fixed start: one that begins with its value (a build flow's key) has its key
    // checked as `failureKey` below.
    /reportFailure\(\s*`([^`$]+)\$\{/g,
    /\bfailed\(\s*"([^"]*)"\)/g,
    /\bact\([^;]*?,\s*"([^"]*)"\)/g,
    /failureKey:\s*"([^"]*)"/g,
  ];
  return patterns.flatMap((pattern) =>
    [...text.matchAll(pattern)].map(([, context = ""]) =>
      context.endsWith(".") ? `${context}x` : context,
    ),
  );
}

describe("the renderer's failure contexts (#1285)", () => {
  it("are each one that logFailure's schema takes", () => {
    const found = sources(RENDERER).flatMap((path) =>
      contextsIn(readFileSync(path, "utf8")).map((context) => ({ path, context })),
    );

    expect(found.length).toBeGreaterThan(50);
    expect(found.filter(({ context }) => !failureContextSchema.safeParse(context).success)).toEqual(
      [],
    );
  });

  it("finds one with a space, as #1285's were", () => {
    expect(contextsIn('reportFailure("assistant status", error);')).toEqual(["assistant status"]);
    expect(failureContextSchema.safeParse("assistant status").success).toBe(false);
    const template = ["reportFailure(`command.", "$", "{id}`, error);"].join("");
    expect(contextsIn(template)).toEqual(["command.x"]);
  });
});
