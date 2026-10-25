import { t } from "@webforge/i18n";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext, ResolvedImage } from "../schema.js";
import { siteLibrary } from "./index.js";

const defaults = siteLibrary.components.Logos?.defaults ?? {};

const acme: ResolvedImage = {
  src: "media/acme.png",
  sources: [],
  fallback: { type: "image/png", srcset: "media/acme.png 320w" },
  width: 320,
  height: 96,
  alt: "Acme Ltd",
};

/** What the export gives, with one logo in Media and another without alt text. */
const context: RenderContext = {
  ...EDITOR_RENDER_CONTEXT,
  image: (id) => (id === "acme" ? acme : id === "plain" ? { ...acme, alt: "" } : null),
  href: (link) => (link.kind === "url" ? link.href : "index.html"),
};

/** The Logos section with `props` over its defaults, as the export renders it. */
const render = (props: Record<string, unknown> = {}) =>
  renderNodesToHtml(
    [{ type: "Logos", props: { id: "logos", ...defaults, ...props } }],
    siteLibrary,
    context,
  );

const windows: Window[] = [];
afterEach(async () => {
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

/** A page of `html`, to query. */
function page(html: string) {
  const happy = new Window();
  windows.push(happy);
  happy.document.body.innerHTML = html;
  return happy.document;
}

/** A logo with `props`. */
const logo = (id: string, props: Record<string, unknown> = {}) => ({
  type: "Logo",
  props: { id, ...props },
});

const website = { kind: "url", href: "https://www.acme.example/about" };

describe("the Logos section", () => {
  it("renders a title and four spaces for logos, as the Add panel places it", () => {
    const doc = page(render());

    expect(doc.querySelector(".site-logos h2")?.textContent).toBe(t("starter.logosTitle"));
    expect(doc.querySelectorAll(".site-logo")).toHaveLength(4);
    expect(doc.querySelector(".site-logo img")).toBeNull();
    expect(doc.querySelector(".site-logo a")).toBeNull();
  });

  it("lays its logos out in a row that wraps or in a grid of tiles", () => {
    const row = page(render({ variant: "row", items: [logo("one")] }));
    const grid = page(render({ variant: "grid", items: [logo("one")] }));

    expect(row.querySelector(".site-logo")?.parentElement?.className).toContain("flex-wrap");
    expect(row.querySelector(".site-logo")?.className).not.toContain("border");
    expect(grid.querySelector(".site-logo")?.parentElement?.className).toContain("md:grid-cols-4");
    expect(grid.querySelector(".site-logo")?.className).toContain("border");
  });

  it("names a logo by its alt text here, else Media's, else the company's name", () => {
    const items = [
      logo("own", { image: { mediaId: "acme", alt: "Acme, our partner" } }),
      logo("media", { image: { mediaId: "acme" }, name: "Unused" }),
      logo("name", { image: { mediaId: "plain" }, name: " Acme " }),
    ];
    const images = [...page(render({ items })).querySelectorAll(".site-logo img")];

    expect(images.map((each) => each.getAttribute("alt"))).toEqual([
      "Acme, our partner",
      "Acme Ltd",
      "Acme",
    ]);
  });

  it("links a logo with a link, which always has a name: else where it goes", () => {
    const items = [
      logo("named", { image: { mediaId: "plain" }, name: "Acme", link: website }),
      logo("host", { image: { mediaId: "plain" }, link: website }),
      logo("page", { image: { mediaId: "plain" }, link: { kind: "page", pageId: "home" } }),
      logo("empty", { link: website }),
      logo("unlinked", { image: { mediaId: "plain" } }),
    ];
    const tiles = [...page(render({ items })).querySelectorAll(".site-logo")];

    expect(tiles.map((each) => each.tagName)).toEqual(["A", "A", "A", "A", "DIV"]);
    expect(tiles[0]?.getAttribute("href")).toBe(website.href);
    expect(tiles.map((each) => each.querySelector("img")?.getAttribute("alt"))).toEqual([
      "Acme",
      "acme.example",
      t("siteText.logo"),
      undefined,
      "",
    ]);
    // A logo still to be chosen names its link in text only screen readers hear.
    expect(tiles[3]?.querySelector(".sr-only")?.textContent).toBe("acme.example");
  });

  it("gives each logo's row in the Edit panel the company's name to fill in", () => {
    expect(siteLibrary.components.Logo?.fields.name?.kind).toBe("text");
  });
});
