import type { FormService, SiteSnapshot } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { sampleSite } from "@webforge/test-utils";
import { scaledTestTimeout } from "@webforge/test-utils/vitest";
import { beforeAll, describe, expect, it } from "vitest";
import { type BuiltSite, buildSite } from "../src/build.js";
import { loadNodeResources } from "../src/node-resources.js";
import { createPipeline } from "../src/pipeline.js";
import type { PipelineResources } from "../src/resources.js";

let resources: PipelineResources;

beforeAll(async () => {
  resources = await loadNodeResources();
}, scaledTestTimeout(120_000));

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
  it(
    "makes one for a service that sends visitors there, and tells the form its address",
    async () => {
      const built = await buildSite(withForms(WEB3FORMS), siteLibrary, resources);

      const thanks = text(built, "thank-you.html");
      expect(thanks).toContain("<title>Thank you | Rosa's Bakery</title>");
      expect(thanks).toMatch(/<h1[^>]*>Thank you<\/h1>/);
      expect(thanks).toContain("Your message is on its way.");
      expect(thanks).toMatch(/<a [^>]*href="index\.html"[^>]*>Back to the home page<\/a>/);
      // With the site's Header and Footer, and out of its navigation.
      expect(thanks).toContain("<!-- Header (shared) -->");
      expect(text(built, "index.html")).not.toContain("thank-you.html");
      // Only reached by sending a form, so nothing for search engines (3.15, SEO-2).
      expect(thanks).toContain('<meta name="robots" content="noindex">');
      expect(text(built, "sitemap.xml")).not.toContain("thank-you.html");
      expect(contactForm(built)).toContain(
        `<input type="hidden" name="redirect" value="${ADDRESS}/thank-you.html" />`,
      );
      expect(contactForm(built)).toContain('name="botcheck"');
      // The timing check that holds back a form sent at once is in the site's script (B6).
      const script = [...built.files.keys()].find((path) => path.startsWith("assets/js/webforge."));
      expect(text(built, script ?? "")).toContain("SOONEST_MS");
    },
    scaledTestTimeout(60_000),
  );

  it(
    "uses FormSubmit's own field, and the site's own thank-you page if it has one",
    async () => {
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
    },
    scaledTestTimeout(60_000),
  );

  it(
    "makes none without the web address, or for a service that shows its own",
    async () => {
      for (const site of [
        withForms(WEB3FORMS, null),
        withForms(WEB3FORMS, "http://rosas-bakery.example"),
        withForms({ kind: "formspree", formId: "xyzAbc12" }),
      ]) {
        const built = await buildSite(site, siteLibrary, resources);

        expect(built.files.has("thank-you.html")).toBe(false);
        expect(contactForm(built)).not.toMatch(/name="(?:redirect|_next)"/);
      }
    },
    scaledTestTimeout(120_000),
  );

  it(
    "makes none for a site whose only form is hidden",
    async () => {
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
    },
    scaledTestTimeout(60_000),
  );
});

describe("forms with nowhere to send (3.7, X5)", () => {
  it(
    "are reported, each with why, on the page they're on",
    async () => {
      const site = { ...sampleSite(), formService: undefined };

      const built = await buildSite(site, siteLibrary, resources);

      expect(built.report.warnings).toEqual([
        { code: "form-unset", page: "about", detail: "noService" },
        { code: "form-unset", page: "about", detail: "noAddress" },
      ]);
    },
    scaledTestTimeout(60_000),
  );
});

describe("Netlify Forms (4.2)", () => {
  /** The site built by one pipeline, for `host`: its pages' render cache kept between builds. */
  const pipeline = createPipeline(siteLibrary);
  const built = async (site: SiteSnapshot, host?: "netlify") => {
    let done: BuiltSite | undefined;
    for await (const event of pipeline.build(site, resources, { mode: "publish", host })) {
      if (event.stage === "done") done = event.site;
    }
    if (done === undefined) throw new Error("The build didn't finish");
    return done;
  };

  it(
    "draws them for Netlify to find in a build for Netlify, and nowhere else, the page cache too",
    async () => {
      // No web address: Netlify serves the thank-you page from the site's root.
      const site = withForms({ kind: "netlify" }, null);

      // Built for elsewhere first: the form can't send, and nothing is drawn for Netlify.
      const elsewhere = await built(site);
      expect(contactForm(elsewhere)).toContain('data-wf-form-unset="netlify"');
      expect(contactForm(elsewhere)).not.toContain("data-netlify");
      expect(elsewhere.files.has("thank-you.html")).toBe(false);
      expect(elsewhere.report.warnings).toContainEqual({
        code: "form-unset",
        page: "about",
        detail: "netlify",
      });

      // Then for Netlify, by the same pipeline: its cached pages aren't reused.
      const onNetlify = await built(site, "netlify");
      const form = contactForm(onNetlify);
      expect(form).toContain('name="Contact form"');
      expect(form).toContain('data-netlify="true"');
      expect(form).toContain('netlify-honeypot="bot-field"');
      expect(form).toContain('action="/thank-you.html"');
      expect(form).toContain('<input type="hidden" name="form-name" value="Contact form" />');
      expect(form).toContain('name="bot-field"');
      expect(form).not.toContain("data-wf-form-unset");
      expect(text(onNetlify, "thank-you.html")).toContain("Your message is on its way.");
      expect(onNetlify.report.warnings).not.toContainEqual(
        expect.objectContaining({ code: "form-unset", detail: "netlify" }),
      );
    },
    scaledTestTimeout(90_000),
  );
});
