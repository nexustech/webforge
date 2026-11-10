import { defaultSiteSettings } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { type SettingsForm, toSettingsForm } from "./settings-form.js";
import { keptAddressClashes, type SettingsPage, siteSettingsSpec } from "./settings-sections.js";

/** The Forms section's choice of service, for a site with a Netlify destination or not. */
function serviceChoices(onNetlify: boolean, formService: SettingsForm["formService"] = "") {
  const settings = defaultSiteSettings("Rosa's Bakery", "en");
  const spec = siteSettingsSpec(settings, { images: [], imageUrl: () => "", onNetlify });
  const values = { ...toSettingsForm(settings), formService };
  const fields = typeof spec.fields === "function" ? spec.fields(values) : spec.fields;
  const field = fields.find((each) => each.name === "formService");
  return field?.kind === "select" ? field.options.map((option) => option.value) : [];
}

describe("Site Settings' form services (4.2)", () => {
  it("offers Netlify Forms only once the site has a Netlify destination", () => {
    expect(serviceChoices(false)).not.toContain("netlify");
    expect(serviceChoices(true)).toEqual([
      "",
      "formspree",
      "web3forms",
      "formsubmit",
      "netlify",
      "custom",
    ]);
  });

  it("keeps Netlify Forms listed while it's the service chosen, destination or not", () => {
    expect(serviceChoices(false, "netlify")).toContain("netlify");
  });
});

describe("Site Settings' old addresses (#862)", () => {
  const pages: SettingsPage[] = [
    { id: "home", title: "Home", file: "index.html", target: true },
    { id: "about", title: "About", file: "about.html", target: true },
    { id: "lost", title: "Page not found", file: "404.html", target: false },
  ];
  const settings = defaultSiteSettings("Rosa's Bakery", "en");

  it("lists them under Search engines, each going to a page other than 'Page not found'", () => {
    const spec = siteSettingsSpec(settings, { images: [], imageUrl: () => "", pages });
    const values = toSettingsForm(settings);
    const fields = typeof spec.fields === "function" ? spec.fields(values) : spec.fields;
    const list = fields.find((each) => each.name === "keptAddresses");

    expect(list).toMatchObject({ kind: "list", group: "search", path: "search.keptAddresses" });
    if (list?.kind !== "list") throw new Error("no list");
    const page = list.itemFields.find((each) => each.name === "page");
    expect(page?.kind === "select" && page.options.map((option) => option.label)).toEqual([
      "Home (index.html)",
      "About (about.html)",
    ]);
    expect(list.newItem?.()).toEqual({ from: "", page: "home" });
  });

  it("says when a page has an old address now", () => {
    const values: SettingsForm = {
      ...toSettingsForm(settings),
      keptAddresses: [
        { id: "a", from: "old.html", page: "about" },
        { id: "b", from: "/about", page: "home" },
      ],
    };

    expect(keptAddressClashes(values, pages)).toEqual([
      { path: ["search", "keptAddresses", 1, "from"], message: expect.any(String) },
    ]);
  });
});
