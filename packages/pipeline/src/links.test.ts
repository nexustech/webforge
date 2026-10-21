import type { PageId } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { hrefFor } from "./links.js";

const ABOUT = "page-about" as PageId;
const paths = new Map<string, string>([[ABOUT, "company/about-us"]]);
const pathOf = (id: string) => paths.get(id);

describe("hrefFor (F-ED-18)", () => {
  it("links to a page by its id, from the page's folder depth, with a section's anchor", () => {
    expect(hrefFor({ kind: "page", pageId: ABOUT }, pathOf, "")).toBe("company/about-us.html");
    expect(hrefFor({ kind: "page", pageId: ABOUT, anchor: "team" }, pathOf, "../")).toBe(
      "../company/about-us.html#team",
    );
  });

  it("follows a renamed or moved page, since links store its id", () => {
    paths.set(ABOUT, "about");
    expect(hrefFor({ kind: "page", pageId: ABOUT }, pathOf, "")).toBe("about.html");
    paths.set(ABOUT, "company/about-us");
  });

  it("goes nowhere for a deleted page or a file, which isn't exported yet", () => {
    expect(hrefFor({ kind: "page", pageId: "page-gone" as PageId }, pathOf, "")).toBeUndefined();
    expect(hrefFor({ kind: "file", mediaId: "media-a" as never }, pathOf, "")).toBeUndefined();
  });

  it("makes mailto:, tel: and web links", () => {
    expect(hrefFor({ kind: "email", address: "hi@example.com" }, pathOf, "")).toBe(
      "mailto:hi@example.com",
    );
    expect(
      hrefFor({ kind: "email", address: "hi@example.com", subject: "A cake & tea" }, pathOf, ""),
    ).toBe("mailto:hi@example.com?subject=A%20cake%20%26%20tea");
    expect(hrefFor({ kind: "phone", number: "+44 (0)1234 567-890" }, pathOf, "")).toBe(
      "tel:+4401234567890",
    );
    expect(hrefFor({ kind: "url", href: "https://example.com/a" }, pathOf, "")).toBe(
      "https://example.com/a",
    );
  });
});
