import type { PageId } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { element, findIn, siteWith } from "../test-site.test-helper.js";
import { notesRule } from "./notes.js";

describe("notes (UX-17, #868)", () => {
  it("lists each open note, on hidden elements and in slots too, with its text", () => {
    const site = siteWith([
      element("Section", "s", {
        note: "Shorter intro",
        content: [
          element("Heading", "h", { text: "Welcome" }),
          element("Image", "photo", { note: "Swap this photo before launch", hidden: true }),
        ],
      }),
    ]);

    expect(findIn(notesRule, site)).toEqual([
      {
        key: `${site.homePageId}/s/note`,
        place: { kind: "element", on: site.homePageId, nodeId: "s" },
        values: { note: "Shorter intro" },
      },
      {
        key: `${site.homePageId}/photo/note`,
        place: { kind: "element", on: site.homePageId, nodeId: "photo" },
        values: { note: "Swap this photo before launch" },
      },
    ]);
  });

  it("lists a note on a draft page too, which the rest of Site Check leaves out (G37)", () => {
    const site = siteWith([element("Heading", "h")]);
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home page");
    const winter = "winter" as PageId;
    site.pages[winter] = {
      ...home,
      id: winter,
      slug: "winter",
      settings: { ...home.settings, draft: true },
      doc: { root: { props: {} }, content: [element("Heading", "w", { note: "Prices?" })] },
    };
    site.pageOrder.push(winter);

    expect(findIn(notesRule, site).map((finding) => finding.place)).toEqual([
      { kind: "element", on: "winter", nodeId: "w" },
    ]);
  });

  it("lists a note in the Header too, and none once resolved", () => {
    const site = siteWith([element("Heading", "h")]);
    site.layout.header = [element("Header", "header", { note: "Add the phone number" })];

    expect(findIn(notesRule, site).map((finding) => finding.place)).toEqual([
      { kind: "element", on: "header", nodeId: "header" },
    ]);
    expect(findIn(notesRule, siteWith([element("Heading", "h")]))).toEqual([]);
  });
});
