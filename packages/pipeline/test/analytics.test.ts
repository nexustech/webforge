import type { SiteSnapshot } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { sampleSite } from "@webforge/test-utils";
import { beforeAll, describe, expect, it } from "vitest";
import { type BuiltSite, buildSite } from "../src/build.js";
import { loadNodeResources } from "../src/node-resources.js";
import { createPipeline } from "../src/pipeline.js";
import type { PipelineResources } from "../src/resources.js";

let resources: PipelineResources;
/** The sample site with Google Analytics and its banner, built for export. */
let built: BuiltSite;

/** The sample site with a Measurement ID, its banner asking first unless `consentBanner` is false. */
const withAnalytics = (consentBanner = true): SiteSnapshot => ({
  ...sampleSite(),
  analytics: { measurementId: "G-ABC123DEF4", consentBanner },
});

beforeAll(async () => {
  resources = await loadNodeResources();
  built = await buildSite(withAnalytics(), siteLibrary, resources);
}, 120_000);

const text = (site: BuiltSite, path: string) => new TextDecoder().decode(site.files.get(path));
const fileNamed = (site: BuiltSite, pattern: RegExp) =>
  [...site.files.keys()].find((path) => pattern.test(path)) ?? "";

describe("Google Analytics and its consent banner (3.8, B4, B7)", () => {
  it("puts the banner after every page's Footer, and the script that runs it in webforge.js", () => {
    for (const path of ["index.html", "about.html", "thanks.html"]) {
      const html = text(built, path);
      const banner = html.indexOf(
        '<section data-wf-consent="" data-measurement-id="G-ABC123DEF4" data-ask=""',
      );
      expect(banner, path).toBeGreaterThan(html.indexOf("</footer>"));
      expect(banner, path).toBeLessThan(html.indexOf("</body>"));
    }
    expect(text(built, fileNamed(built, /^assets\/js\/webforge\./))).toContain("webforge-consent");
  });

  it("writes no address of Google's into a page: the script adds it once the visitor accepts", async () => {
    const plain = await buildSite(sampleSite(), siteLibrary, resources);
    const absolute = (site: BuiltSite) =>
      text(site, "index.html").match(/(?:src|href|srcSet)="[a-z]+:/gi);

    expect(absolute(built)).toEqual(absolute(plain));
    expect(text(built, "index.html")).not.toContain("googletagmanager");
  }, 60_000);

  it("compiles the banner's classes into the site's stylesheet", () => {
    const css = text(built, fileNamed(built, /^assets\/css\/site\./));

    for (const name of ["inset-x-4", "z-50", "btn-ghost", "max-w-xl"]) {
      expect(css, name).toContain(`.${name}`);
    }
  });

  it("writes the banner without its buttons when the owner turned it off, Google's script then loading at once", async () => {
    const unasked = await buildSite(withAnalytics(false), siteLibrary, resources);
    const index = text(unasked, "index.html");

    expect(index).toContain('<section data-wf-consent="" data-measurement-id="G-ABC123DEF4"');
    expect(index).not.toContain("data-ask");
    expect(index).not.toContain("data-wf-consent-accept");
  }, 60_000);

  it("leaves Google Analytics out of a preview, so the owner's own visits aren't counted", async () => {
    const pipeline = createPipeline(siteLibrary);
    let site: BuiltSite | undefined;
    for await (const event of pipeline.build(withAnalytics(), resources, { mode: "preview" })) {
      if (event.stage === "done") site = event.site;
    }
    if (site === undefined) throw new Error("The preview didn't finish");

    expect(text(site, "index.html")).not.toContain("data-wf-consent");
    expect(text(site, fileNamed(site, /^assets\/js\/webforge\./))).not.toContain(
      "webforge-consent",
    );
  }, 60_000);
});
