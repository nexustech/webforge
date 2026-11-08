import { t } from "@webforge/i18n";
import type { NodeDoc, SiteSnapshot } from "@webforge/model";
import { sampleSite } from "@webforge/test-utils";
import { describe, expect, it } from "vitest";
import { netlifyFormNames } from "../src/netlify-forms.js";

/** A Form element with id `id`, its label `label` (the default when left out). */
const form = (id: string, label?: string, more: Record<string, unknown> = {}): NodeDoc => ({
  type: "Form",
  props: { id, ...(label === undefined ? {} : { label }), ...more },
});

/** The sample site (its Contact form on the About page) with `home` added to its home page. */
function withForms(home: readonly NodeDoc[], header: readonly NodeDoc[] = []): SiteSnapshot {
  const site = sampleSite();
  return {
    ...site,
    layout: { ...site.layout, header: [...site.layout.header, ...header] },
    pages: site.pages.map((page, index) =>
      index === 0
        ? { ...page, doc: { ...page.doc, content: [...page.doc.content, ...home] } }
        : page,
    ),
  };
}

describe("netlifyFormNames (4.2)", () => {
  it("gives two forms with the same label names of their own, in the site's order", () => {
    const label = t("starter.formLabel");
    const site = withForms(
      [
        form("first"),
        // In a Section's slot, after the first: its slots are walked in their order.
        { type: "Section", props: { id: "s", content: [form("nested")] } },
        form("booking", "Booking request"),
        form("hidden", undefined, { hidden: true }),
      ],
      [form("in-header")],
    );

    const names = netlifyFormNames(site);

    // The Header first, then the pages in order: the home page, then the About page's Contact form.
    expect([...names]).toEqual([
      ["in-header", label],
      ["first", `${label} 2`],
      ["nested", `${label} 3`],
      ["booking", "Booking request"],
      [expect.any(String), t("siteText.form.contact")],
    ]);
    // A hidden form, which the export leaves out, has none.
    expect(names.has("hidden")).toBe(false);
  });

  it("names the same forms the same way each time, so publishing again keeps their names", () => {
    const site = withForms([form("a"), form("b")]);
    expect([...netlifyFormNames(site)]).toEqual([...netlifyFormNames(site)]);
  });
});
