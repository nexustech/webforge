import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SiteSnapshot } from "@webforge/model";

const FIXTURES = join(import.meta.dirname, "../fixtures");

/** The fixture photo: a 1600×1000 JPEG (generated landscape, no rights issues). */
export function heroPhoto(): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURES, "media/hero.jpg")));
}

/**
 * A small two-page site: Header and Footer, a home page with a Hero (with photo), text and an FAQ,
 * and an About page. Used by pipeline tests and the export E2E tests.
 */
export function sampleSite(): SiteSnapshot {
  return {
    name: "Rosa's Bakery",
    language: "en-GB",
    theme: { name: "cupcake" },
    layout: {
      header: [{ type: "Header", props: { id: "header", siteName: "Rosa's Bakery" } }],
      footer: [{ type: "Footer", props: { id: "footer", text: "© Rosa's Bakery, Hightown" } }],
    },
    pages: [
      {
        id: "home",
        path: "index",
        title: "Home",
        description: "Fresh bread and cakes, baked every morning in Hightown.",
        doc: {
          root: { props: {} },
          content: [
            {
              type: "Hero",
              props: {
                id: "hero",
                title: "Baked fresh every morning",
                text: "Sourdough, cakes and pastries from our oven to your table.",
                buttonLabel: "About us",
                buttonLink: "about",
                alignment: "left",
                image: "hero-photo",
                imageDescription: "Green hills under a morning sun",
              },
            },
            {
              type: "Section",
              props: {
                id: "intro",
                padding: "medium",
                content: [
                  {
                    type: "Heading",
                    props: { id: "intro-heading", text: "Our bakery", size: "medium" },
                  },
                  {
                    type: "Text",
                    props: {
                      id: "intro-text",
                      text: '<p>We have baked in Hightown since 1998.</p><p>Find us on <a href="https://example.com/map">the map</a>.</p>',
                    },
                  },
                  {
                    type: "Faq",
                    props: {
                      id: "faq",
                      title: "Questions",
                      items: [
                        {
                          type: "FaqItem",
                          props: {
                            id: "faq-hours",
                            question: "When are you open?",
                            answer: "<p>Tuesday to Sunday, 7am to 3pm.</p>",
                          },
                        },
                        {
                          type: "FaqItem",
                          props: {
                            id: "faq-orders",
                            question: "Do you take orders?",
                            answer: "<p>Yes, for cakes: order two days ahead.</p>",
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      {
        id: "about",
        path: "about",
        title: "About us",
        doc: {
          root: { props: {} },
          content: [
            {
              type: "Section",
              props: {
                id: "about",
                padding: "large",
                content: [
                  {
                    type: "Heading",
                    props: { id: "about-heading", text: "About Rosa's Bakery", size: "large" },
                  },
                  {
                    type: "Text",
                    props: { id: "about-text", text: "<p>A family bakery since 1998.</p>" },
                  },
                ],
              },
            },
          ],
        },
      },
    ],
    media: [{ id: "hero-photo", name: "hero", mimeType: "image/jpeg", data: heroPhoto() }],
  };
}
