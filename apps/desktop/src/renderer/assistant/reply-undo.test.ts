import { describe, expect, it } from "vitest";
import { replyUndo } from "./reply-undo.js";

const history = (ids: string[], cursor = ids.length) => ({
  entries: ids.map((id) => ({ id })),
  cursor,
});

describe("replyUndo (ADR 0026 §7, AIA-5)", () => {
  it("undoes a reply's steps when they are the newest applied, in order, to the entry before", () => {
    expect(replyUndo(history(["a", "b", "c"]), ["b", "c"])).toEqual({ kind: "undo", to: "a" });
  });

  it("counts steps merged into one entry once: edits to one field in a row (#973 review)", () => {
    expect(replyUndo(history(["a", "e1"]), ["e1", "e1"])).toEqual({ kind: "undo", to: "a" });
    expect(replyUndo(history(["a", "e1", "e2"]), ["e1", "e1", "e2"])).toEqual({
      kind: "undo",
      to: "a",
    });
  });

  it("jumps to the start when the reply's steps are the first entries", () => {
    expect(replyUndo(history(["b", "c"]), ["b", "c"])).toEqual({ kind: "undo", to: null });
  });

  it("offers the safety version once something has happened since", () => {
    expect(replyUndo(history(["b", "c", "d"]), ["b", "c"])).toEqual({ kind: "moved-on" });
    // The person undid one of them and made another change: the history has branched.
    expect(replyUndo(history(["b", "x"]), ["b", "c"])).toEqual({ kind: "moved-on" });
  });

  it("says the steps are already undone when Undo has taken them all back", () => {
    expect(replyUndo(history(["a", "b", "c"], 1), ["b", "c"])).toEqual({ kind: "undone" });
  });

  it("offers the safety version when only some of them are undone, or they are gone", () => {
    expect(replyUndo(history(["a", "b", "c"], 2), ["b", "c"])).toEqual({ kind: "moved-on" });
    // Past the 200-step limit, the oldest entries are dropped.
    expect(replyUndo(history(["c", "d"]), ["b", "c"])).toEqual({ kind: "moved-on" });
    expect(replyUndo(history(["a"]), [])).toEqual({ kind: "moved-on" });
  });
});
