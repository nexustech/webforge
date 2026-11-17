import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SITE_TEXT_KEYS,
  type SiteText,
  type SiteTextKey,
  siteTextFor,
} from "@webforge/i18n/site-text";
import { escapeHtml, escapeHtmlText, type SiteSnapshot, THANKS_PATH } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { sampleSite } from "@webforge/test-utils";
import { scaledTestTimeout } from "@webforge/test-utils/vitest";
import { beforeAll, describe, expect, it } from "vitest";
import { type BuiltSite, buildSite } from "../src/build.js";
import { loadNodeResources } from "../src/node-resources.js";

// Timeouts (#1052): building a site with the pipeline's Node resources takes seconds alone, and
// several times that on a busy machine (ADR 0014).

/**
 * The sample site in German, with what writes a label of its own: its Header and Footer, a
 * carousel, a gallery and its lightbox, a video and a map, opening hours, the contact form and
 * newsletters, the back-to-top button, the consent banner and the thank-you page.
 */
const germanSite = (): SiteSnapshot => {
  const site = sampleSite();
  return {
    ...site,
    language: "de-DE",
    // Two labels in the owner's own words (6.12): theirs, not the language's.
    labels: { "siteText.backToTop": "Ganz nach oben", "siteText.consent.message": "Cookies okay?" },
    // Its own page that says "Thank you" in English: what's checked is the labels, not its words.
    pages: site.pages.filter((page) => page.path !== "thanks"),
    settings: { ...site.settings, "address.url": "https://rosas-bakery.example" },
    analytics: { measurementId: "G-TEST12345", consentBanner: true },
    // A service that sends visitors to the site's thank-you page (3.7).
    formService: { kind: "formsubmit", email: "rosa@rosas-bakery.example" },
  };
};

/** A label with its placeholders left in: "Video von {provider} abspielen". */
const template = (labels: SiteText, key: SiteTextKey) =>
  (labels as (key: SiteTextKey) => string)(key);

/** A label's words up to its first placeholder: what's the same wherever it's written. */
const lead = (label: string) => label.split("{")[0]?.trim() ?? "";

let built: BuiltSite;
const html = (path: string) => new TextDecoder().decode(built.files.get(path));

beforeAll(async () => {
  built = await buildSite(germanSite(), siteLibrary, await loadNodeResources());
}, scaledTestTimeout(60_000));

describe("a site's own labels in its language (6.12, CC-1)", () => {
  it("exports a German site with none of its labels in English", () => {
    const english = siteTextFor("en");
    const german = siteTextFor("de");
    // Each label as an element's whole text or an attribute's whole value, where the site writes
    // one; a label with placeholders by its words up to the first, then a space. Those the same in
    // both languages (the providers' names, "Logo") can't tell them apart.
    const labels = SITE_TEXT_KEYS.flatMap((key) => {
      const message = template(english, key);
      const words = lead(message);
      if (words === "" || words === lead(template(german, key))) return [];
      const end = message.includes("{") ? [" ", " "] : ["<", '"'];
      return [
        [key, `>${escapeHtmlText(words)}${end[0]}`, `="${escapeHtml(words)}${end[1]}`] as const,
      ];
    });
    const pages = [...built.files.keys()].filter((path) => path.endsWith(".html"));
    expect(pages).toContain(`${THANKS_PATH}.html`);
    const found = pages.flatMap((path) =>
      labels
        .filter(([, text, value]) => html(path).includes(text) || html(path).includes(value))
        .map(([key]) => `${path}: ${key}`),
    );
    expect(found).toEqual([]);
  });

  it("writes them in German instead, or in the owner's words where they changed one", () => {
    expect(html("index.html")).toContain('aria-label="Ganz nach oben"');
    expect(html("index.html")).toContain("Cookies okay?");
    expect(html("index.html")).toContain('aria-label="Hauptnavigation"');
    expect(html("index.html")).toContain("Alle akzeptieren");
    expect(html("about.html")).toContain("Öffnungszeiten");
    expect(html("about.html")).toContain("Dienstag bis Freitag");
    expect(html("about.html")).toContain('aria-label="Kontaktformular"');
    expect(html(`${THANKS_PATH}.html`)).toContain("Vielen Dank");
  });

  // Its timeout: every source file of the renderer, read as the whole suite runs (#1052).
  it(
    "has everything that writes into a site take its labels from the site's language",
    () => {
      // `t` and `template` give the app's language, English: never a label of the site (6.12). The
      // site components and the pipeline write the site; the editor writes pages into it (the
      // Cookie page names the banner's buttons).
      const root = join(import.meta.dirname, "..", "..", "..");
      const folders = [
        "packages/site-components/src",
        "packages/pipeline/src",
        "apps/desktop/src/renderer",
      ];
      const offending = folders.flatMap((folder) =>
        readdirSync(join(root, folder), { recursive: true, encoding: "utf8" })
          .filter((file) => /\.tsx?$/.test(file) && !/\.(test|stories)\.tsx?$/.test(file))
          .filter((file) =>
            /\b(?:t|template)\(\s*["`]siteText\./.test(
              readFileSync(join(root, folder, file), "utf8"),
            ),
          )
          .map((file) => join(folder, file)),
      );
      expect(offending).toEqual([]);
    },
    scaledTestTimeout(60_000),
  );
});
