import { describe, expect, it } from "vitest";
import { BINDABLE_SETTINGS, bindingOf, settingValue, settingValues } from "./bindings.js";
import { defaultSiteSettings } from "./settings.js";

const settings = {
  ...defaultSiteSettings("Rosa's Bakery", "en-GB"),
  contact: {
    businessName: "Rosa's Bakery Ltd",
    phone: "+44 1234 567890",
    email: "  ",
    openingHours: [],
  },
  address: { url: "https://www.rosasbakery.co.uk" },
};

describe("bindings", () => {
  it("reads a field's binding, ignoring anything that isn't one", () => {
    expect(bindingOf({ siteName: "general.name" }, "siteName")).toBe("general.name");
    expect(bindingOf({ siteName: "general.name" }, "text")).toBeUndefined();
    expect(bindingOf({ siteName: "contact.fax" }, "siteName")).toBeUndefined();
    expect(bindingOf("general.name", "siteName")).toBeUndefined();
    expect(bindingOf(undefined, "siteName")).toBeUndefined();
  });

  it("resolves each setting, treating blank values as empty", () => {
    expect(settingValue(settings, "general.name")).toBe("Rosa's Bakery");
    expect(settingValue(settings, "contact.phone")).toBe("+44 1234 567890");
    expect(settingValue(settings, "contact.email")).toBeUndefined();
    expect(settingValue(settings, "contact.address")).toBeUndefined();
    expect(settingValues(settings)).toEqual({
      "general.name": "Rosa's Bakery",
      "contact.businessName": "Rosa's Bakery Ltd",
      "contact.phone": "+44 1234 567890",
      "address.url": "https://www.rosasbakery.co.uk",
    });
    for (const key of BINDABLE_SETTINGS) {
      expect(() => settingValue(settings, key)).not.toThrow();
    }
  });
});
