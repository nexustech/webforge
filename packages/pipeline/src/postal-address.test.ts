import { describe, expect, it } from "vitest";
import { postalAddressOf } from "./postal-address.js";

/** The `PostalAddress` fields Google's local business rich results document. */
const GOOGLE_FIELDS = [
  "@type",
  "streetAddress",
  "addressLocality",
  "addressRegion",
  "postalCode",
  "addressCountry",
];

describe("a postal address from what was typed (3.15, SEO-1)", () => {
  it("reads the templates' UK addresses: the street, then the town with its postcode", () => {
    expect(postalAddressOf("7 Bridge Street, Kendal LA9 7DD", "en-GB")).toEqual({
      "@type": "PostalAddress",
      streetAddress: "7 Bridge Street",
      addressLocality: "Kendal",
      postalCode: "LA9 7DD",
      addressCountry: "GB",
    });
    expect(postalAddressOf("Unit 3, Canal Works, Leeds ls11 5qr", "en-GB")).toMatchObject({
      streetAddress: "Unit 3, Canal Works",
      addressLocality: "Leeds",
      postalCode: "LS11 5QR",
    });
  });

  it("takes a part to a line, and a postcode on a line of its own", () => {
    expect(postalAddressOf("1 High Street\nHightown\nAB1 2CD\n", "en-GB")).toEqual({
      "@type": "PostalAddress",
      streetAddress: "1 High Street",
      addressLocality: "Hightown",
      postalCode: "AB1 2CD",
      addressCountry: "GB",
    });
  });

  it("reads a US state and ZIP code, and four to six digits elsewhere", () => {
    expect(postalAddressOf("123 Main St, Springfield, IL 62704", "en-US")).toEqual({
      "@type": "PostalAddress",
      streetAddress: "123 Main St",
      addressLocality: "Springfield",
      addressRegion: "IL",
      postalCode: "62704",
      addressCountry: "US",
    });
    expect(postalAddressOf("Hauptstraße 5, 10115 Berlin", "de-DE")).toMatchObject({
      streetAddress: "Hauptstraße 5",
      addressLocality: "Berlin",
      postalCode: "10115",
      addressCountry: "DE",
    });
  });

  it("finds a UK postcode or a ZIP code for a language with no region, as the templates' `en`", () => {
    expect(postalAddressOf("7 Bridge Street, Kendal LA9 7DD", "en")).toEqual({
      "@type": "PostalAddress",
      streetAddress: "7 Bridge Street",
      addressLocality: "Kendal",
      postalCode: "LA9 7DD",
    });
    expect(postalAddressOf("9 Elm Road, Portland 97201", "en")).toMatchObject({
      addressLocality: "Portland",
      postalCode: "97201",
    });
    expect(postalAddressOf("1 Rue X, 75001 Paris", "zh-Hant-TW")).toMatchObject({
      addressLocality: "Paris",
      postalCode: "75001",
      addressCountry: "TW",
    });
  });

  it("leaves out what it can't find: no country without a region, a one-part address all street", () => {
    expect(postalAddressOf("1 High Street, Hightown", "en")).toEqual({
      "@type": "PostalAddress",
      streetAddress: "1 High Street",
      addressLocality: "Hightown",
    });
    expect(postalAddressOf("The Old Mill", "en-GB")).toEqual({
      "@type": "PostalAddress",
      streetAddress: "The Old Mill",
      addressCountry: "GB",
    });
    expect(postalAddressOf(" , \n", "en-GB")).toBeUndefined();
  });

  it("writes only the fields Google documents", () => {
    for (const typed of ["7 Bridge Street, Kendal LA9 7DD", "123 Main St, Springfield, IL 62704"]) {
      const address = postalAddressOf(typed, typed.includes("IL") ? "en-US" : "en-GB");
      for (const field of Object.keys(address ?? {})) {
        expect(GOOGLE_FIELDS, field).toContain(field);
      }
    }
  });
});
