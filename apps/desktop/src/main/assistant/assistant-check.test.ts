import { describe, expect, it } from "vitest";
import { changedBy, checkMessages, checkResult } from "./assistant-check.js";

const report = (found: unknown[]) =>
  JSON.stringify({ status: "done", data: { mode: "export", found } });

describe("the check of a reply's work (5.18, OL-3)", () => {
  it("knows a reply's pages from its changes, and a change on no one page as site-wide", () => {
    expect(
      changedBy([{ target: { pageId: "home" } }, { target: { pageId: "home", nodeId: "a" } }]),
    ).toEqual({ pages: new Set(["home"]), siteWide: false });
    expect(changedBy([{ target: { pageId: "home" } }, {}]).siteWide).toBe(true);
  });

  it("keeps a page's own findings and its elements', dropping other pages' and site-wide ones", () => {
    const text = report([
      {
        rule: "pageTitle",
        level: "should",
        places: [
          { kind: "page", pageId: "about" },
          { kind: "page", pageId: "home" },
        ],
      },
      { rule: "menu", level: "tip", places: [{ kind: "menu", itemId: "m1" }] },
      { rule: "odd", level: "tip", places: ["not a place"] },
    ]);

    expect(JSON.parse(checkResult(text, changedBy([{ target: { pageId: "about" } }])))).toEqual({
      status: "done",
      about: expect.stringContaining("Never say something worked"),
      checked: "pages",
      pages: ["about"],
      found: [{ rule: "pageTitle", level: "should", places: [{ kind: "page", pageId: "about" }] }],
    });
  });

  it("passes on an answer that isn't a report as it came", () => {
    const pages = changedBy([{ target: { pageId: "home" } }]);
    expect(checkResult("not JSON", pages)).toBe("not JSON");
    const busy = JSON.stringify({ status: "busy", message: "The person is editing." });
    expect(checkResult(busy, pages)).toBe(busy);
  });

  it("gives the model the check as a call of Run Site Check and its result", () => {
    expect(checkMessages("site-check-2", "{}")).toEqual([
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "site-check-2",
            type: "function",
            function: { name: "runSiteCheck", arguments: "{}" },
          },
        ],
      },
      { role: "tool", tool_call_id: "site-check-2", content: "{}" },
    ]);
  });
});
