import { describe, expect, it } from "vitest";
import { factDetailsIn, factKeysIn, settingsFactKeys, unknownFactsIn } from "./facts.js";
import { createSite } from "./site-doc.js";

const kinds = (text: string) =>
  factDetailsIn(text).map(({ kind, text: written }) => [kind, written]);

describe("details shaped like facts (#1228, WN-3)", () => {
  it("finds phone numbers, email and web addresses, prices, times, days and postcodes", () => {
    expect(
      kinds(
        "Call 01632 960123 or write to hello@rosas.co.uk. Order at www.rosas.co.uk/order: a loaf is £3.50. Open Mon–Fri 7am to 3.30pm, Saturdays 08:00. Find us at HT1 2AB.",
      ),
    ).toEqual([
      ["email", "hello@rosas.co.uk"],
      ["web", "www.rosas.co.uk/order"],
      ["price", "£3.50"],
      ["phone", "01632 960123"],
      ["time", "7am"],
      ["time", "3.30pm"],
      ["time", "08:00"],
      ["day", "Mon"],
      ["day", "Fri"],
      ["day", "Saturdays"],
      ["postcode", "HT1 2AB"],
    ]);
  });

  it("finds nothing in plain words, years, counts or dates", () => {
    expect(factDetailsIn("We sat in the sun, baking since 1998 for 2,000 neighbours.")).toEqual([]);
    expect(factDetailsIn("Opened on 2026-11-21, with 12 kinds of bread.")).toEqual([]);
  });

  it("keys a detail the same however it's written", () => {
    const key = (text: string) => factDetailsIn(text).map(({ key: found }) => found);
    expect(key("+44 1632 960123")).toEqual(key("01632 960 123"));
    expect(key("9am")).toEqual(key("09:00"));
    expect(key("5.30 pm")).toEqual(key("17:30"));
    expect(key("Tuesday")).toEqual(key("Tue"));
    expect(key("£12")).toEqual(key("£12.00"));
    expect(key("https://www.rosas.co.uk/")).toEqual(key("rosas.co.uk"));
    expect(key("HT1 2AB")).toEqual(key("HT12AB"));
  });

  it("names the details that appear nowhere the person gave them", () => {
    const known = factKeysIn(["Ring 01632 960123, open 9am"]);
    expect(
      unknownFactsIn("Ring +44 1632 960123 from 09:00, or 020 7946 0000 after 5pm", known).map(
        ({ text }) => text,
      ),
    ).toEqual(["020 7946 0000", "5pm"]);
  });

  it("knows Site Settings' details, its opening hours as stored", () => {
    const site = createSite({
      name: "Rosa's Bakery",
      language: "en",
      homeTitle: "Home",
      notFoundTitle: "Not found",
    });
    const known = settingsFactKeys({
      ...site.settings,
      contact: {
        ...site.settings.contact,
        phone: "0113 496 0000",
        email: "orders@rosas.co.uk",
        openingHours: [{ days: ["tue", "wed", "thu", "fri"], opens: "07:00", closes: "15:00" }],
      },
    });
    const unknown = (text: string) => unknownFactsIn(text, known).map(({ text: found }) => found);
    expect(unknown("Tue–Fri, 7am–3pm: ring 0113 496 0000 or orders@rosas.co.uk")).toEqual([]);
    expect(unknown("Mon–Fri, 7am–4pm")).toEqual(["4pm", "Mon"]);
  });
});
