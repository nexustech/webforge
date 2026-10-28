import type { SiteSnapshot } from "@webforge/model";
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

const text = (site: BuiltSite, path: string) => new TextDecoder().decode(site.files.get(path));
const stylesheet = (site: BuiltSite) =>
  text(site, [...site.files.keys()].find((path) => path.startsWith("assets/css/site.")) ?? "");

/** The sample site with two Buttons on its home page, one with corners of its own. */
function withButtons(looks?: NonNullable<SiteSnapshot["theme"]["looks"]>): SiteSnapshot {
  const site = sampleSite();
  const [home, ...rest] = site.pages;
  if (home === undefined) throw new Error("The sample site has no pages");
  const buttons = [
    { type: "Button", props: { id: "look", label: "Follows the look" } },
    { type: "Button", props: { id: "own", label: "Its own", lookCorners: "none" } },
  ];
  return {
    ...site,
    ...(looks === undefined ? {} : { theme: { ...site.theme, looks } }),
    pages: [{ ...home, doc: { ...home.doc, content: [...home.doc.content, ...buttons] } }, ...rest],
  };
}

/** A Button's opening tag, by its label. */
const buttonTag = (html: string, label: string) =>
  new RegExp(`<a [^>]*>(?:(?!</a>).)*${label}`, "s").exec(html)?.[0] ?? "";

describe("each kind's look in the export (3.12, CT-1)", () => {
  it("draws every Button that doesn't set its corners in the theme's look for Buttons, styled", async () => {
    const built = await buildSite(
      withButtons({ Button: { lookCorners: "full" } }),
      siteLibrary,
      resources,
    );
    const index = text(built, "index.html");

    expect(buttonTag(index, "Follows the look")).toContain("rounded-full!");
    // A Button's own corners win over its kind's look.
    expect(buttonTag(index, "Its own")).toContain("rounded-none!");
    expect(buttonTag(index, "Its own")).not.toContain("rounded-full!");
    // The look's classes are compiled into the site's stylesheet with the page's own.
    expect(stylesheet(built)).toContain(String.raw`.rounded-full\!`);
  }, 60_000);

  it("exports a site exactly as before when its theme has no looks", async () => {
    const without = await buildSite(withButtons(), siteLibrary, resources);
    const empty = await buildSite(withButtons({}), siteLibrary, resources);

    expect(text(empty, "index.html")).toBe(text(without, "index.html"));
    expect(stylesheet(empty)).toBe(stylesheet(without));
  }, 60_000);
});
