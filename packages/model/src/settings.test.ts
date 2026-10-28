import { describe, expect, it } from "vitest";
import {
  defaultSiteSettings,
  siteSettingsSchema,
  verificationCodeOf,
  verificationCodeSchema,
  webAddressSchema,
} from "./settings.js";

describe("verification codes (3.15, SEO-8)", () => {
  it("takes the code from what was pasted: the code, or the whole tag", () => {
    expect(verificationCodeOf(" abcDEF123_-xyz ", "google")).toBe("abcDEF123_-xyz");
    const google = '<meta name="google-site-verification" content="abcDEF123_-xyz" />';
    expect(verificationCodeOf(google, "google")).toBe("abcDEF123_-xyz");
    const bing = "<meta name='msvalidate.01' content='0123456789ABCDEF'>";
    expect(verificationCodeOf(bing, "bing")).toBe("0123456789ABCDEF");
    // Another engine's tag stays as pasted, which isn't a code: the field says so.
    expect(verificationCodeOf(google, "bing")).toBe(google);
    expect(verificationCodeSchema.safeParse(verificationCodeOf(google, "bing")).success).toBe(
      false,
    );
  });

  it("accepts Google's and Bing's codes, and nothing that could break out of the tag", () => {
    expect(verificationCodeSchema.safeParse("abcDEF123_-xyz").success).toBe(true);
    expect(verificationCodeSchema.safeParse("0123456789ABCDEF").success).toBe(true);
    for (const wrong of ["", "short", 'a"><script>', "has spaces in it"]) {
      expect(verificationCodeSchema.safeParse(wrong).success, wrong).toBe(false);
    }
  });
});

const full = {
  general: {
    name: "Rosa's Bakery",
    description: "Fresh bread in Hightown",
    language: "en-GB",
    icon: "logo",
  },
  address: { url: "https://www.rosas-bakery.co.uk" },
  social: {
    profiles: [{ network: "instagram", url: "https://instagram.com/rosasbakery" }],
    shareImage: "shop",
    xHandle: "@rosasbakery",
  },
  contact: {
    businessName: "Rosa's Bakery Ltd",
    email: "hello@rosas-bakery.co.uk",
    phone: "+44 1234 567890",
    address: "1 High Street\nHightown",
    openingHours: [{ days: ["tue", "wed", "thu", "fri"], opens: "07:00", closes: "15:00" }],
    openingHoursNote: "Closed on bank holidays",
  },
  search: { allowIndexing: true, includeSitemap: false },
  analytics: { measurementId: "G-ABC123XYZ", consentBanner: true },
  forms: { service: { kind: "formspree", formId: "xyzzabcd" } },
  publish: {
    destinations: [
      {
        kind: "ftp",
        id: "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10",
        name: "My host",
        protocol: "sftp",
        host: "ftp.example.com",
        port: 22,
        username: "rosa",
        remotePath: "/public_html",
      },
      { kind: "netlify", id: "0b9a8f6e-3c2d-4e1f-8a7b-6c5d4e3f2a10", name: "Netlify" },
    ],
  },
  allowedExternalUrls: ["https://widgets.example.com"],
};

describe("siteSettingsSchema", () => {
  it("accepts complete settings and the defaults of a new site", () => {
    expect(siteSettingsSchema.parse(full)).toEqual(full);
    const defaults = defaultSiteSettings("Rosa's Bakery", "en");
    expect(siteSettingsSchema.parse(defaults)).toEqual(defaults);
    // A new site helps AI tools read it (F-EX-5, 3.5).
    expect(defaults.search).toEqual({
      allowIndexing: true,
      includeSitemap: true,
      readableByAi: true,
    });
    expect(defaults.analytics.consentBanner).toBe(true);
  });

  it.each([
    ["an empty site name", { general: { ...full.general, name: "" } }],
    ["a language name instead of a tag", { general: { ...full.general, language: "English" } }],
    ["an invalid e-mail address", { contact: { ...full.contact, email: "rosa@" } }],
    ["a phone number with letters", { contact: { ...full.contact, phone: "call us" } }],
    [
      "opening hours with an impossible time",
      {
        contact: {
          ...full.contact,
          openingHours: [{ days: ["mon"], opens: "25:00", closes: "15:00" }],
        },
      },
    ],
    [
      "opening hours without days",
      {
        contact: { ...full.contact, openingHours: [{ days: [], opens: "07:00", closes: "15:00" }] },
      },
    ],
    [
      "a social link that isn't a web address",
      { social: { profiles: [{ network: "x", url: "x" }] } },
    ],
    [
      "an unknown network",
      { social: { profiles: [{ network: "myspace", url: "https://example.com" }] } },
    ],
    [
      "a GA4 id in another format",
      { analytics: { measurementId: "UA-1234-1", consentBanner: true } },
    ],
    ["a form service without its id", { forms: { service: { kind: "formspree" } } }],
    [
      "a password on a destination",
      { publish: { destinations: [{ ...full.publish.destinations[0], password: "secret" }] } },
    ],
    ["an unknown section", { extra: {} }],
    [
      "a host that is neither a name nor an IP address",
      { publish: { destinations: [{ ...full.publish.destinations[0], host: "ftp://x" }] } },
    ],
  ])("rejects %s", (_name, change) => {
    expect(siteSettingsSchema.safeParse({ ...full, ...change }).success).toBe(false);
  });
});

describe("publish destinations", () => {
  it.each(["203.0.113.10", "2001:db8::1", "ftp.example.co.uk"])(
    "accept the FTP host %s",
    (host) => {
      const destination = { ...full.publish.destinations[0], host };
      const settings = { ...full, publish: { destinations: [destination] } };

      expect(siteSettingsSchema.safeParse(settings).success).toBe(true);
    },
  );
});

describe("webAddressSchema", () => {
  it.each(["https://example.com", "https://www.example.co.uk/"])("accepts %s", (url) => {
    expect(webAddressSchema.parse(url)).toBe(url);
  });

  it.each([
    "http://example.com",
    "https://example.com/about",
    "https://example.com/?a=1",
    "https://example.com/#top",
    "https://user@example.com",
    "example.com",
    "https://localhost",
  ])("rejects %s", (url) => {
    expect(webAddressSchema.safeParse(url).success).toBe(false);
  });
});
