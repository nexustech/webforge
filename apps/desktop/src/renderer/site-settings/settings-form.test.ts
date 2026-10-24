import { defaultSiteSettings, type SiteSettings } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { sessionWith } from "../testing/fixtures.js";
import {
  checkSettings,
  fromSettingsForm,
  type SettingsForm,
  saveSiteSettings,
  toSettingsForm,
} from "./settings-form.js";

const full: SiteSettings = {
  general: { name: "Rosa's Bakery", description: "Fresh bread", language: "en-GB" },
  address: { url: "https://www.rosasbakery.co.uk" },
  social: {
    profiles: [{ network: "instagram", url: "https://instagram.com/rosas" }],
    xHandle: "@rosas",
  },
  contact: {
    businessName: "Rosa's Bakery Ltd",
    email: "hello@rosasbakery.co.uk",
    phone: "+44 1234 567890",
    address: "1 High Street, Hightown",
    openingHours: [{ days: ["tue", "wed", "thu", "fri"], opens: "07:00", closes: "15:00" }],
    openingHoursNote: "Closed on bank holidays",
  },
  search: { allowIndexing: true, includeSitemap: false },
  analytics: { measurementId: "G-ABC123DEF4", consentBanner: true },
  forms: { service: { kind: "formspree", formId: "mzbqwxyz" } },
  publish: { destinations: [] },
  allowedExternalUrls: ["https://maps.example.com/"],
};

const edit = (settings: SiteSettings, change: Partial<SettingsForm>): SettingsForm => ({
  ...toSettingsForm(settings),
  ...change,
});

describe("settings form", () => {
  it("turns settings into the form and back unchanged", () => {
    for (const settings of [full, defaultSiteSettings("My site", "en")]) {
      expect(checkSettings(toSettingsForm(settings), settings)).toEqual({ ok: true, settings });
    }
  });

  it("leaves empty fields out, trims what was typed and tidies addresses and handles", () => {
    const form = edit(defaultSiteSettings("My site", "en"), {
      name: "  Rosa's  ",
      email: "  ",
      url: "https://www.example.com/",
      xHandle: "rosas",
      measurementId: "g-abc123def4",
      openingHours: [{ days: ["fri", "mon"], opens: "09:00", closes: "17:00" }],
    });

    expect(fromSettingsForm(form, full)).toMatchObject({
      general: { name: "Rosa's" },
      address: { url: "https://www.example.com" },
      social: { xHandle: "@rosas" },
      analytics: { measurementId: "G-ABC123DEF4" },
      contact: { openingHours: [{ days: ["mon", "fri"] }] },
      // What the dialog doesn't edit stays as it was.
      allowedExternalUrls: ["https://maps.example.com/"],
    });
    expect(fromSettingsForm(form, full)).not.toHaveProperty("contact.email");
  });

  it("sets and clears the form service", () => {
    const settings = defaultSiteSettings("My site", "en");
    const check = (change: Partial<SettingsForm>) =>
      checkSettings(edit(settings, change), settings);

    expect(check({ formService: "netlify" })).toMatchObject({
      settings: { forms: { service: { kind: "netlify" } } },
    });
    expect(check({ formService: "formsubmit", formValue: "hi@example.com" })).toMatchObject({
      settings: { forms: { service: { kind: "formsubmit", email: "hi@example.com" } } },
    });
    expect(
      check({ formService: "custom", formValue: "https://forms.example.com/in" }),
    ).toMatchObject({
      settings: { forms: { service: { kind: "custom" } } },
    });
    expect(check({ formService: "" })).toMatchObject({ settings: { forms: {} } });
    expect(toSettingsForm(full)).toMatchObject({ formService: "formspree", formValue: "mzbqwxyz" });
  });

  it("explains what to fix, field by field, in words people use", () => {
    const result = checkSettings(
      edit(full, {
        name: "",
        language: "English",
        url: "http://www.example.com/shop",
        email: "rosa at example",
        phone: "call us",
        xHandle: "@this-is-not-a-handle",
        measurementId: "UA-1234",
        profiles: [{ network: "facebook", url: "facebook.com/rosas" }],
        openingHours: [{ days: [], opens: "7am", closes: "15:00" }],
        formService: "web3forms",
        formValue: "not-a-key",
      }),
      full,
    );

    expect(result).toEqual({
      ok: false,
      errors: {
        "general.name": "Give the site a name of up to 100 characters.",
        "general.language": "Use a language code such as en or en-GB.",
        "address.url":
          "Use the site's address starting with https://, such as https://www.example.com, without a page or folder.",
        "social.profiles.0.url": "Use the profile's full address, starting with https://.",
        "social.xHandle": "Use your X username, such as @rosasbakery.",
        "contact.email": "Use an email address such as hello@example.com.",
        "contact.phone": "Use a phone number such as +44 1234 567890.",
        "contact.openingHours.0.days": "Choose at least one day.",
        "contact.openingHours.0.opens": "Use a time such as 09:00.",
        "analytics.measurementId": "Use a measurement ID such as G-ABC123DEF4.",
        "forms.value": "Use the access key from Web3Forms.",
      },
    });
  });
});

describe("saveSiteSettings", () => {
  it("names every section a save changed, and none for a change outside them (R10)", () => {
    const session = sessionWith();
    const before = session.history.document.getState().settings;
    const labels = () => session.history.state.getState().entries.map((entry) => entry.label);

    saveSiteSettings(session, {
      ...before,
      general: { ...before.general, name: "Rosa's" },
      analytics: { ...before.analytics, measurementId: "G-ABC123DEF4" },
    });
    expect(labels()).toEqual(["Changed Site Settings: General, Analytics"]);

    // Allowed external addresses are set elsewhere (C8), not in a section of the dialog.
    saveSiteSettings(session, {
      ...session.history.document.getState().settings,
      allowedExternalUrls: ["https://maps.example.com"],
    });
    expect(labels().at(-1)).toBe("Changed Site Settings");
  });

  it("saves as one labelled undo step, and does nothing when nothing changed", () => {
    const session = sessionWith();
    const before = session.history.document.getState().settings;

    expect(saveSiteSettings(session, before)).toBe(false);
    // The same settings with their keys in another order, as the dialog builds them, change nothing.
    const { general, ...rest } = before;
    expect(
      saveSiteSettings(session, {
        ...rest,
        general: { language: general.language, name: general.name },
      }),
    ).toBe(false);
    expect(
      saveSiteSettings(session, { ...before, contact: { ...before.contact, phone: "+44 1" } }),
    ).toBe(true);

    const { entries } = session.history.state.getState();
    // Named for the section it changed (R10), as the dialog names it.
    expect(entries.map((entry) => entry.label)).toEqual(["Changed Site Settings: Contact & hours"]);
    expect(session.history.document.getState().settings.contact.phone).toBe("+44 1");
    session.history.undo();
    expect(session.history.document.getState().settings).toEqual(before);
  });
});
