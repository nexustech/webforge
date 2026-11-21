import { describe, expect, it } from "vitest";
import { isSampleEmail, isSamplePhone, sampleDetailsIn } from "./sample-details.js";

describe("sample details (#1254)", () => {
  it("knows an email address at a domain kept for examples", () => {
    expect(isSampleEmail("hello@example.com")).toBe(true);
    expect(isSampleEmail("bookings@mail.example.org")).toBe(true);
    expect(isSampleEmail("me@site.test")).toBe(true);
    expect(isSampleEmail("rosa@rosasbakery.co.uk")).toBe(false);
    // A business called Example has a domain of its own.
    expect(isSampleEmail("hi@myexample.com")).toBe(false);
    expect(isSampleEmail("not an address")).toBe(false);
  });

  it("knows the phone numbers kept for drama and examples, however they're written", () => {
    // Every template's sample (consultant, café, salon, shop, trades).
    for (const sample of [
      "+44 20 7946 0000",
      "+44 1632 960 123",
      "+44 1632 960 456",
      "+44 117 496 0000",
      "+44 1632 960 789",
    ]) {
      expect(isSamplePhone(sample), sample).toBe(true);
    }
    expect(isSamplePhone("01632 960123")).toBe(true);
    expect(isSamplePhone("0044 7700 900 555")).toBe(true);
    expect(isSamplePhone("(555) 010-0123")).toBe(false);
    expect(isSamplePhone("+1 212 555 0142")).toBe(true);
    // Real numbers, beside the blocks.
    expect(isSamplePhone("+44 20 7946 1000")).toBe(false);
    expect(isSamplePhone("01632 961000")).toBe(false);
    expect(isSamplePhone("+1 212 555 0200")).toBe(false);
    expect(isSamplePhone("020 7123 4567")).toBe(false);
  });

  it("finds them in running text, as written there", () => {
    expect(
      sampleDetailsIn("Call +44 1632 960 123 or write to hello@example.com, Mon–Fri 9–5."),
    ).toEqual(["hello@example.com", "+44 1632 960 123"]);
    expect(sampleDetailsIn("Call 020 7123 4567 or write to rosa@rosas.co.uk.")).toEqual([]);
  });
});
