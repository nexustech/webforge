import type { FormService, SiteDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { levelIn } from "../check.js";
import { element, findIn, siteWith } from "../test-site.test-helper.js";
import { formsRule } from "./forms.js";

/** `site` with Site Settings' form service. */
const withService = (site: SiteDoc, service: FormService | undefined): SiteDoc => ({
  ...site,
  settings: { ...site.settings, forms: service === undefined ? {} : { service } },
});

describe("forms (3.7)", () => {
  const contact = element("ContactForm", "write");
  const nested = element("Section", "box", { content: [element("Form", "ask")] });

  it("finds each form that posts to a service Site Settings don't have, wherever it is", () => {
    const site = siteWith([contact, nested]);
    const home = site.homePageId;

    expect(findIn(formsRule, site)).toEqual([
      {
        key: `${home}/write/form`,
        place: { kind: "element", on: home, nodeId: "write" },
        values: { reason: "noService", form: "service" },
      },
      {
        key: `${home}/ask/form`,
        place: { kind: "element", on: home, nodeId: "ask" },
        values: { reason: "noService", form: "service" },
      },
    ]);
    expect(findIn(formsRule, withService(site, { kind: "formspree", formId: "xyzAbc12" }))).toEqual(
      [],
    );
  });

  it("finds a service that can't take messages yet: Netlify Forms, an address that isn't https", () => {
    const site = siteWith([contact]);
    const reasons = (service: FormService) =>
      findIn(formsRule, withService(site, service)).map((found) => found.values?.reason);

    expect(reasons({ kind: "netlify" })).toEqual(["netlify"]);
    expect(reasons({ kind: "custom", url: "http://forms.example.com/in" })).toEqual(["insecure"]);
    expect(reasons({ kind: "custom", url: "https://forms.example.com/in" })).toEqual([]);
  });

  it("finds a Newsletter without its own form address, whatever Site Settings' service", () => {
    const site = withService(
      siteWith([
        element("Newsletter", "none"),
        element("Newsletter", "plain", { action: "http://example.com/signup" }),
        element("Newsletter", "ok", { action: "https://example.com/signup" }),
      ]),
      { kind: "formspree", formId: "xyzAbc12" },
    );

    expect(findIn(formsRule, site).map((found) => [found.place, found.values])).toEqual([
      [
        { kind: "element", on: site.homePageId, nodeId: "none" },
        { reason: "noAddress", form: "newsletter" },
      ],
      [
        { kind: "element", on: site.homePageId, nodeId: "plain" },
        { reason: "insecure", form: "newsletter" },
      ],
    ]);
  });

  it("leaves out a hidden form, which the export leaves out too", () => {
    expect(findIn(formsRule, siteWith([element("ContactForm", "hid", { hidden: true })]))).toEqual(
      [],
    );
  });

  it("is Should fix for an export and Must fix for publishing (X5)", () => {
    expect(levelIn(formsRule, "export")).toBe("should");
    expect(levelIn(formsRule, "publish")).toBe("must");
  });
});
