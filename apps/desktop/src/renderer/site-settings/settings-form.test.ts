import { defaultSiteSettings, type SiteSettings } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { sessionWith } from "../testing/fixtures.js";
import {
  fromSettingsForm,
  type SettingsForm,
  saveSiteSettings,
  settingsSchema,
  toSettingsForm,
} from "./settings-form.js";

/** The form checked as the dialog checks it: the settings, or a message per model path. */
function checkSettings(form: SettingsForm, previous: SiteSettings) {
  const result = settingsSchema["~standard"].validate(fromSettingsForm(form, previous));
  if (result instanceof Promise) throw new Error("Not synchronous");
  if (result.issues === undefined) return { ok: true, settings: result.value } as const;
  const errors: Record<string, string> = {};
  for (const issue of result.issues) {
    const path = (issue.path ?? []).map((key) => String(typeof key === "object" ? key.key : key));
    errors[path.join(".")] ??= issue.message;
  }
  return { ok: false, errors } as const;
}

const full: SiteSettings = {
  general: {
    name: "Rosa's Bakery",
    description: "Fresh bread",
    language: "en-GB",
    backToTop: true,
    businessType: "food",
  },
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
  search: { allowIndexing: true, includeSitemap: false, readableByAi: true },
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

  it("turns the back-to-top button on and off, storing nothing when off (F-CM-9)", () => {
    expect(toSettingsForm(full).backToTop).toBe(true);
    const off = checkSettings(edit(full, { backToTop: false }), full);
    expect(off.ok && off.settings.general).not.toHaveProperty("backToTop");
  });

  it("turns AI tools' copies off, and leaves a site from before them as it was (F-EX-5)", () => {
    const off = checkSettings(edit(full, { readableByAi: false }), full);
    expect(off.ok && off.settings.search.readableByAi).toBe(false);

    const older: SiteSettings = { ...full, search: { allowIndexing: true, includeSitemap: true } };
    expect(toSettingsForm(older).readableByAi).toBe(false);
    expect(checkSettings(toSettingsForm(older), older)).toEqual({ ok: true, settings: older });
    const on = checkSettings(edit(older, { readableByAi: true }), older);
    expect(on.ok && on.settings.search.readableByAi).toBe(true);
  });

  it("sets and clears the business type, storing nothing while none is chosen (SEO-9)", () => {
    const shop = checkSettings(edit(full, { businessType: "shop" }), full);
    expect(shop.ok && shop.settings.general.businessType).toBe("shop");

    const none = checkSettings(edit(full, { businessType: "" }), full);
    expect(none.ok && "businessType" in none.settings.general).toBe(false);
  });

  it("keeps the search engines' verification codes, from the whole tags pasted too (3.15)", () => {
    const saved = checkSettings(
      edit(full, {
        googleVerification: '<meta name="google-site-verification" content="abcDEF123_-xyz" />',
        bingVerification: " 0123456789ABCDEF ",
      }),
      full,
    );
    expect(saved.ok && saved.settings.search.verification).toEqual({
      google: "abcDEF123_-xyz",
      bing: "0123456789ABCDEF",
    });
    expect(saved.ok && toSettingsForm(saved.settings).googleVerification).toBe("abcDEF123_-xyz");

    // Google's tag in Bing's field isn't saved under Bing's name: the field says what it is.
    const swapped = checkSettings(
      edit(full, {
        bingVerification: '<meta name="google-site-verification" content="abcDEF123_-xyz" />',
      }),
      full,
    );
    expect(!swapped.ok && swapped.errors["search.verification.bing"]).toBe(
      "That isn't Bing's verification code. Paste the code, or the whole msvalidate.01 tag from Bing Webmaster Tools.",
    );

    // Emptied, nothing is stored.
    const none = checkSettings(edit(full, { googleVerification: "", bingVerification: "" }), full);
    expect(none.ok && none.settings.search).not.toHaveProperty("verification");
    // Something that isn't a code says so, at its field.
    const wrong = checkSettings(edit(full, { googleVerification: "not a code!" }), full);
    expect(wrong.ok).toBe(false);
    expect(!wrong.ok && wrong.errors["search.verification.google"]).toBeDefined();
  });

  it("leaves empty fields out, trims what was typed and tidies addresses and handles", () => {
    const form = edit(defaultSiteSettings("My site", "en"), {
      name: "  Rosa's  ",
      email: "  ",
      url: "https://www.example.com/",
      xHandle: "rosas",
      measurementId: "g-abc123def4",
      consentMessage: "  Cookies?  ",
      openingHours: [{ id: "a", days: ["fri", "mon"], opens: "09:00", closes: "17:00" }],
    });

    expect(fromSettingsForm(form, full)).toMatchObject({
      general: { name: "Rosa's" },
      address: { url: "https://www.example.com" },
      social: { xHandle: "@rosas" },
      analytics: { measurementId: "G-ABC123DEF4", consentMessage: "Cookies?" },
      contact: { openingHours: [{ days: ["mon", "fri"] }] },
      // What the dialog doesn't edit stays as it was.
      allowedExternalUrls: ["https://maps.example.com/"],
    });
    expect(fromSettingsForm(form, full)).not.toHaveProperty("contact.email");
    // An empty banner text is the standard one (3.8).
    expect(fromSettingsForm(edit(full, { consentMessage: " " }), full)).not.toHaveProperty(
      "analytics.consentMessage",
    );
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

  it("explains what to fix at each model path, in the settings' words or the editor's (2.21)", () => {
    const result = checkSettings(
      edit(full, {
        name: "",
        language: "English",
        url: "http://www.example.com/shop",
        email: "rosa at example",
        phone: "call us",
        xHandle: "@this-is-not-a-handle",
        measurementId: "UA-1234",
        profiles: [{ id: "a", network: "facebook", url: "facebook.com/rosas" }],
        openingHours: [{ id: "b", days: [], opens: "7am", closes: "15:00" }],
        formService: "web3forms",
        formValue: "not-a-key",
      }),
      full,
    );

    expect(result).toEqual({
      ok: false,
      errors: {
        // Empty or too long: the editor's general words.
        "general.name": "Fill this in.",
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
        "forms.service.accessKey": "Use the access key from Web3Forms.",
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
