import { describe, expect, it } from "vitest";
import { anchorIdSchema, linkValueSchema, phoneNumberSchema } from "./link.js";

describe("linkValueSchema", () => {
  it.each([
    { kind: "page", pageId: "about" },
    { kind: "page", pageId: "about", anchor: "opening-times", newTab: false },
    { kind: "email", address: "rosa@example.com", subject: "Order" },
    { kind: "phone", number: "+44 (0)1234 567-890" },
    { kind: "url", href: "https://example.com/menu?x=1", newTab: true },
    { kind: "url", href: "http://example.com" },
    { kind: "file", mediaId: "menu-pdf" },
  ])("accepts %j", (link) => {
    expect(linkValueSchema.parse(link)).toEqual(link);
  });

  it.each([
    { kind: "page", pageId: "__proto__" },
    { kind: "page", pageId: "about", anchor: "Opening Times" },
    { kind: "email", address: "rosa" },
    { kind: "phone", number: "call me" },
    { kind: "url", href: "javascript:alert(1)" },
    { kind: "url", href: "ftp://example.com" },
    { kind: "url", href: "https://" },
    { kind: "url", href: "about" },
    { kind: "file" },
    { kind: "page", pageId: "about", target: "_blank" },
    { kind: "map" },
  ])("rejects %j", (link) => {
    expect(linkValueSchema.safeParse(link).success).toBe(false);
  });
});

describe("anchorIdSchema", () => {
  it("accepts lowercase hyphenated names that start with a letter", () => {
    expect(anchorIdSchema.parse("opening-times-2")).toBe("opening-times-2");
    for (const bad of ["2nd", "a--b", "a b", "-a", "a-", "x".repeat(65)]) {
      expect(anchorIdSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("phoneNumberSchema", () => {
  it.each(["+44 1234 567890", "(01234) 567890", "01234-567-890"])("accepts %s", (number) => {
    expect(phoneNumberSchema.parse(number)).toBe(number);
  });

  it.each(["call me", "12", "+", "-1234"])("rejects %s", (number) => {
    expect(phoneNumberSchema.safeParse(number).success).toBe(false);
  });
});
