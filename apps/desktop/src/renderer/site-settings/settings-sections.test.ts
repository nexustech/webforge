import { CONSENT_MESSAGE_LABEL, defaultSiteSettings } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { type SettingsForm, toSettingsForm } from "./settings-form.js";
import {
  keptAddressClashes,
  labelIssues,
  type SettingsPage,
  siteSettingsSpec,
} from "./settings-sections.js";
import { CHANGEABLE_LABELS, labelOptions, labelPlace } from "./site-labels.js";
import { languageOptions, SITE_LANGUAGES } from "./site-languages.js";

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
        // In any case: a folder on Windows or macOS would write it over the page (#862).
        { id: "c", from: "About.html", page: "home" },
      ],
    };

    expect(keptAddressClashes(values, pages)).toEqual([
      { path: ["search", "keptAddresses", 1, "from"], message: expect.any(String) },
      { path: ["search", "keptAddresses", 2, "from"], message: expect.any(String) },
    ]);
  });
});

describe("Site Settings' language, by name (6.12, CC-1)", () => {
  it("lists the languages by name, alphabetically, each storing its code", () => {
    const options = languageOptions("en-GB");
    expect(options).toHaveLength(SITE_LANGUAGES.length);
    expect(options).toContainEqual({ label: "German (Austria)", value: "de-AT" });
    expect(options).toContainEqual({ label: "English (United Kingdom)", value: "en-GB" });
    const names = options.map((option) => option.label);
    expect(names).toEqual(names.toSorted((a, b) => a.localeCompare(b, "en")));
  });

  it("keeps a language not on the list, shown as its code, so opening the dialog changes nothing", () => {
    expect(languageOptions("gd-GB")[0]).toEqual({ label: "gd-GB", value: "gd-GB" });
    expect(languageOptions("de")).not.toContainEqual({ label: "de", value: "de" });
  });

  it("is a choice in General, as the site's language", () => {
    const settings = defaultSiteSettings("Rosa's Bakery", "fr-CA");
    const spec = siteSettingsSpec(settings, { images: [], imageUrl: () => "" });
    const values = toSettingsForm(settings);
    const fields = typeof spec.fields === "function" ? spec.fields(values) : spec.fields;
    expect(fields.find((each) => each.name === "language")).toMatchObject({
      kind: "select",
      group: "general",
      path: "general.language",
    });
  });
});

describe("Site Settings' Labels on your site (6.12, CC-1)", () => {
  const settings = defaultSiteSettings("Rosa's Bakery", "de");

  it("offers every label but the cookie banner's text, by where it shows, in the site's language", () => {
    expect(CHANGEABLE_LABELS).not.toContain(CONSENT_MESSAGE_LABEL);
    expect(CHANGEABLE_LABELS.filter((key) => labelPlace(key) === undefined)).toEqual([]);
    const options = labelOptions("de");
    expect(options.map((option) => option.value).toSorted()).toEqual(
      [...CHANGEABLE_LABELS].toSorted(),
    );
    expect(options).toContainEqual({ label: "Header and Footer: Menü", value: "siteText.menu" });
    expect(options).toContainEqual({ label: "Forms: Name", value: "siteText.form.name" });
    // Its placeholders in, as the label is.
    expect(options).toContainEqual({
      label: "Carousel: {n} von {total}",
      value: "siteText.slideOf",
    });
    // Made once per language, then again for another.
    expect(labelOptions("de")).toBe(options);
    expect(labelOptions("fr")).toContainEqual({
      label: "Header and Footer: Menu",
      value: "siteText.menu",
    });
    expect(labelOptions("fr")).not.toBe(options);
  });

  it("is a list in General, a new row the first label, without wording yet", () => {
    const spec = siteSettingsSpec(settings, { images: [], imageUrl: () => "" });
    const fields = typeof spec.fields === "function" ? spec.fields(toSettingsForm(settings)) : [];
    const list = fields.find((each) => each.name === "labels");
    expect(list).toMatchObject({ kind: "list", group: "general", path: "general.labels" });
    if (list?.kind !== "list") throw new Error("no list");
    expect(list.newItem?.()).toEqual({ key: labelOptions("de")[0]?.value, text: "" });
  });

  it("asks for a row's wording, and says when a label is changed twice", () => {
    const values: SettingsForm = {
      ...toSettingsForm(settings),
      labels: [
        { id: "a", key: "siteText.menu", text: "Speisekarte" },
        { id: "b", key: "siteText.close", text: "  " },
        { id: "c", key: "siteText.menu", text: "Karte" },
      ],
    };
    expect(labelIssues(values)).toEqual([
      { path: ["general", "labels", 1, "text"], message: expect.any(String) },
      { path: ["general", "labels", 2, "key"], message: expect.any(String) },
    ]);
  });
});
