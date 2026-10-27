import type { FormService, SiteSnapshot } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { sampleSite } from "@webforge/test-utils";
import { beforeAll, describe, expect, it } from "vitest";
import { type BuiltSite, buildSite } from "../src/build.js";
import { loadNodeResources } from "../src/node-resources.js";
import type { PipelineResources } from "../src/resources.js";

let resources: PipelineResources;

beforeAll(async () => {
  resources = await loadNodeResources();
}, 120_000);

const ADDRESS = "https://rosas-bakery.example";
const WEB3FORMS: FormService = {
  kind: "web3forms",
  accessKey: "0f8fad5b-d9cb-469f-a165-70867728950e",
};

/** The sample site (its Contact form on the About page) with `service` and the web `address` (none for `null`). */
const withForms = (service: FormService, address: string | null = ADDRESS): SiteSnapshot => {
  const site = sampleSite();
  return {
    ...site,
    formService: service,
    settings: { ...site.settings, ...(address === null ? {} : { "address.url": address }) },
  };
};

const text = (site: BuiltSite, path: string) => new TextDecoder().decode(site.files.get(path));
/** The About page's Contact form, as the export writes it. */
const contactForm = (site: BuiltSite) =>
  /<form[^>]*aria-label="Contact form"[^>]*>.*?<\/form>/s.exec(text(site, "about.html"))?.[0] ?? "";

describe("forms' thank-you page (3.7, B3)", () => {
  it("makes one for a service that sends visitors there, and tells the form its address", async () => {
    const built = await buildSite(withForms(WEB3FORMS), siteLibrary, resources);

    const thanks = text(built, "thank-you.html");
    expect(thanks).toContain("<title>Thank you | Rosa's Bakery</title>");
    expect(thanks).toMatch(/<h1[^>]*>Thank you<\/h1>/);
    expect(thanks).toContain("Your message is on its way.");
    expect(thanks).toMatch(/<a [^>]*href="index\.html"[^>]*>Back to the home page<\/a>/);
    // With the site's Header and Footer, and out of its navigation.
    expect(thanks).toContain("<!-- Header (shared) -->");
    expect(text(built, "index.html")).not.toContain("thank-you.html");
    expect(contactForm(built)).toContain(
      `<input type="hidden" name="redirect" value="${ADDRESS}/thank-you.html" />`,
    );
    expect(contactForm(built)).toContain('name="botcheck"');
    // The timing check that holds back a form sent at once is in the site's script (B6).
    const script = [...built.files.keys()].find((path) => path.startsWith("assets/js/webforge."));
    expect(text(built, script ?? "")).toContain("SOONEST_MS");
  }, 60_000);

  it("uses FormSubmit's own field, and the site's own thank-you page if it has one", async () => {
    const base = withForms({ kind: "formsubmit", email: "rosa@example.com" }, `${ADDRESS}/`);
    const own = base.pages[2];
    if (own === undefined) throw new Error("The sample site has no third page");
    const site = {
      ...base,
      pages: base.pages.map((page) => (page === own ? { ...page, path: "thank-you" } : page)),
    };

    const built = await buildSite(site, siteLibrary, resources);

    expect(contactForm(built)).toContain(
      `<input type="hidden" name="_next" value="${ADDRESS}/thank-you.html" />`,
    );
    expect(contactForm(built)).toContain('name="_honey"');
    // The site's own page there, not one made for it.
    expect(text(built, "thank-you.html")).toContain(`<title>${own.title} | Rosa's Bakery`);
    expect(built.report.pages).toBe(3);
  }, 60_000);

  it("makes none without the web address, or for a service that shows its own", async () => {
    for (const site of [
      withForms(WEB3FORMS, null),
      withForms(WEB3FORMS, "http://rosas-bakery.example"),
      withForms({ kind: "formspree", formId: "xyzAbc12" }),
    ]) {
      const built = await buildSite(site, siteLibrary, resources);

      expect(built.files.has("thank-you.html")).toBe(false);
      expect(contactForm(built)).not.toMatch(/name="(?:redirect|_next)"/);
    }
  }, 120_000);

  it("makes none for a site whose only form is hidden", async () => {
    const site = withForms(WEB3FORMS);
    const hidden = {
      ...site,
      pages: site.pages.map((page) => ({
        ...page,
        doc: {
          ...page.doc,
          content: page.doc.content.map((node) =>
            node.type === "ContactForm"
              ? { ...node, props: { ...node.props, hidden: true } }
              : node,
          ),
        },
      })),
    };

    expect((await buildSite(hidden, siteLibrary, resources)).files.has("thank-you.html")).toBe(
      false,
    );
  }, 60_000);
});

describe("forms with nowhere to send (3.7, X5)", () => {
  it("are reported, each with why, on the page they're on", async () => {
    const site = { ...sampleSite(), formService: undefined };

    const built = await buildSite(site, siteLibrary, resources);

    expect(built.report.warnings).toEqual([
      { code: "form-unset", page: "about", detail: "noService" },
      { code: "form-unset", page: "about", detail: "noAddress" },
    ]);
  }, 60_000);
});
