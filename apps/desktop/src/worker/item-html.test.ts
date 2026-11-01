import type { SiteSnapshot } from "@webforge/model";
import { sampleSite } from "@webforge/test-utils";
import { describe, expect, it } from "vitest";
import { itemHtmlFor } from "./item-html.js";

const job = (pageId: string, nodeId: string, snapshot: SiteSnapshot = sampleSite()) => ({
  type: "item-html" as const,
  snapshot,
  sizes: { "hero-photo": { width: 1600, height: 1000 } },
  pageId,
  nodeId,
});

describe("itemHtmlFor (3.14)", () => {
  it("answers with the item as the export writes it, or null when it isn't there", () => {
    const hero = itemHtmlFor(job("home", "hero"));
    expect(hero.type === "item-html" && hero.html).toContain("assets/img/hero-1600.webp");
    expect(itemHtmlFor(job("home", "nothing"))).toEqual({ type: "item-html", html: null });
  });

  it("fails without details when the item can't be drawn", () => {
    const site = sampleSite();
    const broken = {
      ...site,
      layout: { ...site.layout, header: [{ type: "NoSuchThing", props: { id: "x" } }] },
    };

    expect(itemHtmlFor(job("home", "x", broken))).toEqual({ type: "item-html-failed" });
  });
});
