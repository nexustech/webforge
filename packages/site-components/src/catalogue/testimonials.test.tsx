import { t } from "@webforge/i18n";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext, ResolvedImage } from "../schema.js";
import { siteLibrary } from "./index.js";

const defaults = siteLibrary.components.Testimonials?.defaults ?? {};

const photo: ResolvedImage = {
  src: "media/rosa.jpg",
  sources: [],
  fallback: { type: "image/jpeg", srcset: "media/rosa.jpg 400w" },
  width: 400,
  height: 400,
  alt: "Rosa at her counter",
};

/** What the export gives, with one photo in Media. */
const context: RenderContext = {
  ...EDITOR_RENDER_CONTEXT,
  image: (id) => (id === "rosa" ? photo : null),
};

/** The Testimonials section with `props` over its defaults, as the export renders it. */
const render = (props: Record<string, unknown> = {}) =>
  renderNodesToHtml(
    [{ type: "Testimonials", props: { id: "testimonials", ...defaults, ...props } }],
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

/** One testimonial with Rosa's photo, and `alt` for it if given. */
const withPhoto = (alt?: string) => [
  {
    type: "Testimonial",
    props: {
      id: "rosa",
      quote: "Best bread in town.",
      name: "Rosa",
      role: "Owner, Rosa's Bakery",
      photo: alt === undefined ? { mediaId: "rosa" } : { mediaId: "rosa", alt },
    },
  },
];

describe("the Testimonials section", () => {
  it("renders with its title and three testimonials, as the Add panel places it", () => {
    const doc = page(render());

    expect(doc.querySelector(".site-testimonials h2")?.textContent).toBe(
      t("starter.testimonialsTitle"),
    );
    const items = doc.querySelectorAll("figure.site-testimonial");
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.querySelector("blockquote")?.textContent).toBe(t("starter.testimonialQuote"));
      expect(item.querySelector("figcaption")?.textContent).toBe(
        `${t("starter.testimonialName")}${t("starter.testimonialRole")}`,
      );
      // No photo yet: no image, and no empty space for one.
      expect(item.querySelector("img")).toBeNull();
    }
  });

  it("lays its testimonials out as cards, large quotes or a photo beside each", () => {
    const cards = page(render({ variant: "cards" }));
    const large = page(render({ variant: "large" }));
    const photos = page(render({ variant: "photos" }));

    expect(cards.querySelector(".site-testimonial")?.className).toContain("bg-base-200");
    expect(cards.querySelector(".site-testimonial svg")).not.toBeNull();
    expect(large.querySelector(".site-testimonial blockquote")?.className).toContain("text-2xl");
    expect(large.querySelector(".grid")?.className).toContain("max-w-3xl");
    expect(photos.querySelector(".grid")?.className).toContain("md:grid-cols-2");
    expect(photos.querySelector(".site-testimonial")?.className).toContain("items-start");
  });

  it("shows a photo with its alt text here, else Media's", () => {
    const own = page(render({ items: withPhoto("Rosa smiling") }));
    const media = page(render({ items: withPhoto() }));

    expect(own.querySelector(".site-testimonial img")?.getAttribute("alt")).toBe("Rosa smiling");
    expect(media.querySelector(".site-testimonial img")?.getAttribute("alt")).toBe(
      "Rosa at her counter",
    );
  });

  it("shows nothing for a photo no longer in Media", () => {
    const doc = page(
      render({
        items: [
          {
            type: "Testimonial",
            props: { id: "gone", quote: "Lovely.", name: "Sam", photo: { mediaId: "gone" } },
          },
        ],
      }),
    );

    expect(doc.querySelector(".site-testimonial img")).toBeNull();
    expect(doc.querySelector(".site-testimonial blockquote")?.textContent).toBe("Lovely.");
  });

  it("casts a shadow under the pointer when set, and nothing unless set", () => {
    const plain = page(render());
    const shadowed = page(
      render({
        items: [{ type: "Testimonial", props: { id: "s", quote: "Great.", hover: "shadow" } }],
      }),
    );

    expect(plain.querySelector(".site-testimonial")?.className).not.toContain("hover:");
    expect(shadowed.querySelector(".site-testimonial")?.className).toContain("hover:shadow-lg");
  });
});
