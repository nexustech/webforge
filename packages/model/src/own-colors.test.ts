import { describe, expect, it } from "vitest";
import {
  countOneOffUses,
  countOwnColorUses,
  type IsColorField,
  newOwnColorId,
  oneOffUsesIn,
  rewriteOneOffUses,
  rewriteOwnColorUses,
  toOwnColor,
} from "./own-colors.js";
import { createSite } from "./site-doc.js";
import { ownColorIdSchema } from "./theme.js";

/** The colour fields of these tests' elements: a Section's background, a list's icons. */
const isColorField: IsColorField = (type, field) =>
  (type === "Section" && field === "lookBackground") ||
  (type === "Features" && field === "items.iconColor");

/** A site with colour `sky` used on an element, for a device, in a list's item and in a look. */
function site() {
  const doc = createSite({
    name: "Rosa's",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  const home = doc.pages[doc.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content = [
    { type: "Section", props: { id: "a", lookBackground: "own-sky-300/50", content: [] } },
    {
      type: "Section",
      props: {
        id: "b",
        lookBackground: { $responsive: { desktop: "own-sky", mobile: "primary" } },
        content: [],
      },
    },
    {
      type: "Features",
      props: {
        id: "c",
        items: [
          { id: "i1", iconColor: "own-sky-700" },
          { id: "i2", iconColor: "own-sea" },
        ],
      },
    },
    // A text that reads like a use, in a field that isn't a colour: never one.
    { type: "Text", props: { id: "d", text: "own-sky" } },
  ];
  doc.theme.looks = { Section: { lookBackground: "own-sky-100" } } as typeof doc.theme.looks;
  return doc;
}

describe("your colours across a site (TC-1b, #1218)", () => {
  it("makes a new id the id's pattern takes, unlike any taken", () => {
    let n = 0;
    const steps = [0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const random = () => steps[n++] ?? 0.5;
    const id = newOwnColorId(["caaaaaaa"], random);
    expect(id).not.toBe("caaaaaaa");
    expect(ownColorIdSchema.safeParse(id).success).toBe(true);
  });

  it("counts every use of a colour in colour fields: elements, devices, list items and looks", () => {
    expect(countOwnColorUses(site(), "sky", isColorField)).toBe(4);
    expect(countOwnColorUses(site(), "sea", isColorField)).toBe(1);
    expect(countOwnColorUses(site(), "none", isColorField)).toBe(0);
  });

  it("gives every use to another colour, its shade and opacity kept, and nothing else", () => {
    const doc = site();
    expect(rewriteOwnColorUses(doc, "sky", isColorField, toOwnColor("sea"))).toBe(4);
    const [a, b, c, d] = doc.pages[doc.homePageId]?.doc.content ?? [];
    expect(a?.props.lookBackground).toBe("own-sea-300/50");
    expect(b?.props.lookBackground).toEqual({
      $responsive: { desktop: "own-sea", mobile: "primary" },
    });
    expect(c?.props.items).toEqual([
      { id: "i1", iconColor: "own-sea-700" },
      { id: "i2", iconColor: "own-sea" },
    ]);
    expect(d?.props.text).toBe("own-sky");
    expect(doc.theme.looks?.Section).toEqual({ lookBackground: "own-sea-100" });
    expect(countOwnColorUses(doc, "sky", isColorField)).toBe(0);
  });
});

/** A site with one-off `#1f6feb` used twice and for a device, at different opacities (TC-3). */
function siteWithOneOff() {
  const doc = site();
  const home = doc.pages[doc.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content = [
    { type: "Section", props: { id: "e", lookBackground: "[#1f6feb]/50", content: [] } },
    {
      type: "Section",
      props: {
        id: "f",
        lookBackground: { $responsive: { desktop: "[#1F6FEB]", mobile: "[#000000]" } },
        content: [],
      },
    },
    {
      type: "Features",
      props: { id: "g", items: [{ id: "i3", iconColor: "[#1f6feb]" }] },
    },
    // Another colour, and the same code in a field that isn't a colour's: never one.
    { type: "Section", props: { id: "h", lookBackground: "[#1f6fec]", content: [] } },
    { type: "Text", props: { id: "t", text: "[#1f6feb]" } },
  ];
  return doc;
}

describe("a one-off colour across a site (TC-3, #1221)", () => {
  it("counts its uses in colour fields at any opacity and for any device, in any case", () => {
    expect(countOneOffUses(siteWithOneOff(), "#1f6feb", isColorField)).toBe(3);
    expect(countOneOffUses(siteWithOneOff(), "#1F6FEB", isColorField)).toBe(3);
    expect(countOneOffUses(siteWithOneOff(), "#123456", isColorField)).toBe(0);
  });

  it("counts a field once when more than one device has it, as Theme Studio's list does (TC-4)", () => {
    const doc = siteWithOneOff();
    doc.pages[doc.homePageId]?.doc.content.push({
      type: "Section",
      props: {
        id: "both",
        lookBackground: { $responsive: { desktop: "[#1f6feb]", mobile: "[#1f6feb]/50" } },
        content: [],
      },
    });
    expect(countOneOffUses(doc, "#1f6feb", isColorField)).toBe(4);
    expect(oneOffUsesIn(doc, isColorField)[0]?.uses).toHaveLength(4);
  });

  it("makes every use one of the person's colours, keeping its opacity, and nothing else", () => {
    const doc = siteWithOneOff();
    expect(rewriteOneOffUses(doc, "#1f6feb", isColorField, toOwnColor("cblue"))).toBe(3);
    const [e, f, g, h, t] = doc.pages[doc.homePageId]?.doc.content ?? [];
    expect(e?.props.lookBackground).toBe("own-cblue/50");
    expect(f?.props.lookBackground).toEqual({
      $responsive: { desktop: "own-cblue", mobile: "[#000000]" },
    });
    expect(g?.props.items).toEqual([{ id: "i3", iconColor: "own-cblue" }]);
    expect(h?.props.lookBackground).toBe("[#1f6fec]");
    expect(t?.props.text).toBe("[#1f6feb]");
    expect(countOneOffUses(doc, "#1f6feb", isColorField)).toBe(0);
  });
});

describe("the one-offs across a site, and where (TC-4, #1222)", () => {
  it("lists each one-off with each field that has it, the most used first", () => {
    const doc = siteWithOneOff();
    const listed = oneOffUsesIn(doc, isColorField);
    const home = doc.homePageId;
    expect(listed).toEqual([
      {
        hex: "#1f6feb",
        uses: [
          { on: home, nodeId: "e", field: "lookBackground" },
          { on: home, nodeId: "f", field: "lookBackground" },
          { on: home, nodeId: "g", field: "items.iconColor" },
        ],
      },
      { hex: "#000000", uses: [{ on: home, nodeId: "f", field: "lookBackground" }] },
      { hex: "#1f6fec", uses: [{ on: home, nodeId: "h", field: "lookBackground" }] },
    ]);
  });

  it("lists none for a site whose colours are all the theme's", () => {
    expect(oneOffUsesIn(site(), isColorField)).toEqual([]);
  });
});
