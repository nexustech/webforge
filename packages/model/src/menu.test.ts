import { describe, expect, it } from "vitest";
import { menuDocSchema } from "./menu.js";

const book = {
  id: "book",
  kind: "button",
  label: "Book now",
  link: { kind: "url", href: "https://booking.example.com" },
  hidden: false,
};

describe("menuDocSchema", () => {
  it("accepts page, link, section and button items and one level of dropdown", () => {
    const menu = {
      follows: "custom",
      items: [
        { id: "home", kind: "page", pageId: "home", hidden: false },
        { id: "about", kind: "page", pageId: "about", label: "Who we are", hidden: true },
        {
          id: "more",
          kind: "group",
          label: "More",
          hidden: false,
          children: [
            {
              id: "hours",
              kind: "section",
              label: "Opening times",
              link: { kind: "page", pageId: "about", anchor: "opening-times" },
              hidden: false,
            },
            {
              id: "insta",
              kind: "link",
              label: "Instagram",
              link: { kind: "url", href: "https://instagram.com/rosa", newTab: true },
              hidden: false,
            },
          ],
        },
        book,
      ],
    };

    expect(menuDocSchema.parse(menu)).toEqual(menu);
  });

  it.each([
    [
      "a dropdown inside a dropdown",
      {
        id: "g",
        kind: "group",
        label: "G",
        hidden: false,
        children: [{ id: "h", kind: "group", label: "H", hidden: false, children: [] }],
      },
    ],
    ["a link without a label", { ...book, label: "" }],
    ["a page item without a page", { id: "p", kind: "page", hidden: false }],
    ["an item without the hidden flag", { id: "p", kind: "page", pageId: "home" }],
    ["an unknown kind", { ...book, kind: "search" }],
  ])("rejects %s", (_name, item) => {
    expect(menuDocSchema.safeParse({ follows: "custom", items: [item] }).success).toBe(false);
  });

  it("rejects an unknown mode", () => {
    expect(menuDocSchema.safeParse({ follows: "auto", items: [] }).success).toBe(false);
  });
});
