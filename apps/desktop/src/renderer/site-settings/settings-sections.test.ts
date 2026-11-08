import { defaultSiteSettings } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { type SettingsForm, toSettingsForm } from "./settings-form.js";
import { siteSettingsSpec } from "./settings-sections.js";

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
