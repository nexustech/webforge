import type { SiteSnapshot } from "@webforge/model";
import { siteSnapshotSchema } from "@webforge/model";
import { sampleSite } from "@webforge/test-utils";
import { describe, expect, it } from "vitest";
import {
  htaccessRules,
  redirectFiles,
  redirectPage,
  redirectsFile,
  writtenRedirects,
} from "./redirects.js";

const ADDRESS = "https://rosas.example";

/** The sample site with `redirects`, and a web address unless `address` is false. */
function site(redirects: SiteSnapshot["redirects"], address = true): SiteSnapshot {
  const sample = sampleSite();
  const { "address.url": _address, ...settings } = sample.settings ?? {};
  return {
    ...sample,
    settings: { ...settings, ...(address ? { "address.url": `${ADDRESS}/` } : {}) },
    redirects,
  };
}

describe("a page's old address kept working (#862, SEO-5)", () => {
  it("moves on at once to the page, with its canonical address, and says where", () => {
    const html = redirectPage(site([]), { from: "about-us.html", to: "about" });

    expect(html).toContain(`<html lang="${site([]).language}">`);
    expect(html).toContain('<meta http-equiv="refresh" content="0; url=about.html">');
    expect(html).toContain(`<link rel="canonical" href="${ADDRESS}/about.html">`);
    expect(html).toContain('<p>This page has moved to <a href="about.html">About');
    expect(html).not.toContain("<script");
  });

  it("links from a folder back up to the page, and to the home page as index.html", () => {
    const html = redirectPage(site([], false), { from: "company/old/team.html", to: "index" });

    expect(html).toContain('content="0; url=../../index.html"');
    expect(html).toContain('<a href="../../index.html">');
    // No web address, no canonical: it must be absolute (SEO-3).
    expect(html).not.toContain("canonical");
  });

  it("writes Netlify's rules, with and without .html, forced past the page at the old address", () => {
    expect(
      redirectsFile([
        { from: "about-us.html", to: "about" },
        { from: "services/old.html", to: "index" },
      ]),
    ).toBe(
      [
        "/about-us.html /about.html 301!",
        "/about-us /about.html 301!",
        "/services/old.html / 301!",
        "/services/old / 301!",
        "",
      ].join("\n"),
    );
  });

  it("makes a page at each old address and _redirects, and nothing without any", () => {
    const files = redirectFiles(site([{ from: "about-us.html", to: "about" }]));
    expect(files.map(([path]) => path)).toEqual(["about-us.html", "_redirects"]);

    expect(redirectFiles(site(undefined))).toEqual([]);
    expect(redirectFiles(site([]))).toEqual([]);
  });

  it("writes neither a page nor a rule at a file the export made, in any case", () => {
    const files = redirectFiles(
      site([
        { from: "Thank-You.html", to: "index" },
        { from: "our-story.html", to: "about" },
        { from: "Our-Story.html", to: "index" },
      ]),
      ["index.html", "thank-you.html"],
    );

    // A folder on Windows or macOS would write Thank-You.html over the thank-you page, and a rule
    // would send every form's visitors away from it.
    expect(files.map(([path]) => path)).toEqual(["our-story.html", "_redirects"]);
    expect(files.at(-1)?.[1]).toBe(
      ["/our-story.html /about.html 301!", "/our-story /about.html 301!", ""].join("\n"),
    );
    expect(
      redirectFiles(site([{ from: "Thank-You.html", to: "index" }]), ["thank-you.html"]),
    ).toEqual([]);
  });

  it("refuses an old address that goes to no page, or is a page's own", () => {
    expect(siteSnapshotSchema.safeParse(site([{ from: "old.html", to: "about" }])).success).toBe(
      true,
    );
    expect(siteSnapshotSchema.safeParse(site([{ from: "old.html", to: "gone" }])).success).toBe(
      false,
    );
    expect(siteSnapshotSchema.safeParse(site([{ from: "about.html", to: "index" }])).success).toBe(
      false,
    );
    // In any case, and once per file in any case (#862).
    expect(siteSnapshotSchema.safeParse(site([{ from: "About.html", to: "index" }])).success).toBe(
      false,
    );
    const twice = site([
      { from: "old.html", to: "about" },
      { from: "OLD.html", to: "index" },
    ]);
    expect(siteSnapshotSchema.safeParse(twice).success).toBe(false);
  });
});

describe("an Apache host's rules for old addresses (5.15, CC-7)", () => {
  it("sends each old address, with or without .html, in any case, on with a 301", () => {
    expect(
      htaccessRules([
        { from: "about-us.html", to: "about" },
        { from: "Services/Old_Page.html", to: "index" },
      ]),
    ).toBe(
      [
        "<IfModule mod_rewrite.c>",
        "RewriteEngine On",
        "RewriteCond %{REQUEST_URI} ^(.*/)about-us(\\.html)?$ [NC]",
        "RewriteRule ^about-us(\\.html)?$ %1about.html [R=301,NC,L]",
        // The home page is the site's folder itself.
        "RewriteCond %{REQUEST_URI} ^(.*/)Services/Old_Page(\\.html)?$ [NC]",
        "RewriteRule ^Services/Old_Page(\\.html)?$ %1 [R=301,NC,L]",
        "</IfModule>",
      ].join("\n"),
    );
  });

  it("goes to a page in a folder, under the folder the site is in on its host", () => {
    const rules = htaccessRules([{ from: "old.html", to: "services/plumbing" }]);
    // %1 is the folder the request came by: `/` at the top of the host, `/shop/` in a folder.
    const [condition] = rules.split("\n").filter((line) => line.startsWith("RewriteCond"));
    const folder = /\^\(\.\*\/\)(.*)\$ \[NC\]$/.exec(condition ?? "")?.[1] ?? "";
    expect(new RegExp(`^(.*/)${folder}$`, "i").exec("/shop/OLD.html")?.[1]).toBe("/shop/");
    expect(rules).toContain("%1services/plumbing.html [R=301,NC,L]");
  });

  it("is written for the old addresses the export writes a page at, and only those", () => {
    const written = writtenRedirects(
      site([
        { from: "Thank-You.html", to: "index" },
        { from: "our-story.html", to: "about" },
      ]),
      ["thank-you.html"],
    );
    expect(written).toEqual([{ from: "our-story.html", to: "about" }]);
  });
});
