import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MenuItemId, PageId, SiteSnapshot } from "@webforge/model";
import { DEFAULT_THEME } from "@webforge/model";

const FIXTURES = join(import.meta.dirname, "../fixtures");

/** The fixture photo: a 1600×1000 JPEG (generated landscape, no rights issues). */
export function heroPhoto(): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURES, "media/hero.jpg")));
}

/** The fixture document: a small PDF price list, linked from the About page (1.28). */
export function priceList(): Uint8Array {
  return new TextEncoder().encode(
    "%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n" +
      "2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\n" +
      "trailer << /Root 1 0 R >>\n%%EOF\n",
  );
}

/**
 * A small two-page site: Header and Footer, a home page with a Hero (with photo), text, a Carousel
 * of customers' quotes (2.10), an FAQ and a Call to action, and an About page with a text-only Hero
 * linking to a price list (a document), a Text section, a Text + Image section (2.6), a Gallery
 * with its lightbox (2.7a), Opening hours and contact from Site Settings, a Video and a Map that
 * load only when clicked, and a Contact form and a Newsletter signup (2.8). Its menu has both
 * pages, a "Visit us" dropdown (a link to the FAQ section and a web address in a new tab) and an
 * "Order a cake" button. Used by pipeline tests and the export E2E tests.
 */
export function sampleSite(): SiteSnapshot {
  return {
    name: "Rosa's Bakery",
    language: "en-GB",
    theme: { ...DEFAULT_THEME, preset: "cupcake" },
    layout: {
      // Centred, its menu below the name: the tallest Header, so anchors are tested under it. Sticky,
      // with a shadow once scrolled (F-DS-6); the Footer in columns, with the menu (2.6).
      header: [
        {
          type: "Header",
          props: {
            id: "header",
            siteName: "Rosa's Bakery",
            variant: "centred",
            sticky: true,
            scrollStyle: "shadow",
          },
        },
      ],
      footer: [
        {
          type: "Footer",
          props: { id: "footer", text: "© Rosa's Bakery, Hightown", variant: "columns" },
        },
      ],
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
                image: { mediaId: "hero-photo", alt: "Green hills under a morning sun" },
              },
            },
            {
              type: "Section",
              props: {
                id: "intro",
                padding: { top: "m", bottom: "m" },
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
                    // Customers' quotes, playing by themselves every 5 seconds (2.10).
                    type: "Carousel",
                    props: {
                      id: "quotes",
                      label: "What customers say",
                      variant: "testimonials",
                      autoplay: true,
                      interval: "5",
                      slides: [
                        {
                          type: "CarouselSlide",
                          props: {
                            id: "quote-sam",
                            text: "The best sourdough in Hightown.",
                            name: "Sam",
                            image: { mediaId: "hero-photo", alt: "" },
                          },
                        },
                        {
                          type: "CarouselSlide",
                          props: {
                            id: "quote-ana",
                            text: "Our wedding cake was perfect.",
                            name: "Ana",
                          },
                        },
                        {
                          type: "CarouselSlide",
                          props: { id: "quote-lee", text: "Worth the queue.", name: "Lee" },
                        },
                      ],
                    },
                  },
                  {
                    type: "Faq",
                    props: {
                      id: "faq",
                      advanced: { anchorId: "questions" },
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
            {
              // A band on the theme's reversed colours (2.4, F-DS-3): dark on this light theme.
              type: "Section",
              props: {
                id: "fresh",
                colors: "inverse",
                content: [
                  {
                    type: "Heading",
                    props: { id: "fresh-heading", text: "Fresh every day", size: "small" },
                  },
                  {
                    type: "Text",
                    props: { id: "fresh-text", text: "<p>Bread from 7 am, cakes from 9.</p>" },
                  },
                ],
              },
            },
            {
              type: "CallToAction",
              props: {
                id: "cta",
                title: "Order a cake",
                text: "Tell us what you'd like two days ahead.",
                buttonLabel: "About ordering",
                buttonLink: "about",
                variant: "banner",
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
              // The page's one heading, and a link to the price list (a document, 1.28).
              type: "Hero",
              props: {
                id: "about",
                title: "About Rosa's Bakery",
                text: "A family bakery since 1998. Cakes to order, with two days' notice.",
                buttonLabel: "Price list (PDF)",
                buttonLink: { kind: "file", mediaId: "price-list", newTab: true },
                variant: "minimal",
              },
            },
            {
              type: "TextSection",
              props: {
                id: "story",
                title: "Our story",
                text: "<p>Rosa opened the bakery with one oven.</p><p>We still bake every morning.</p>",
              },
            },
            {
              type: "TextImage",
              props: {
                id: "what",
                title: "What we bake",
                text: "<p>Sourdough, rye and cakes to order.</p>",
                image: { mediaId: "hero-photo", alt: "Hills where our wheat grows" },
                variant: "imageLeft",
              },
            },
            {
              // Opens each image larger in its lightbox (2.7a).
              type: "Gallery",
              props: {
                id: "work",
                title: "Our work",
                images: [
                  {
                    type: "GalleryImage",
                    props: {
                      id: "work-1",
                      image: { mediaId: "hero-photo", alt: "Hills at sunrise" },
                      caption: "Where our wheat grows",
                    },
                  },
                  {
                    type: "GalleryImage",
                    props: { id: "work-2", image: { mediaId: "hero-photo", alt: "Hills at noon" } },
                  },
                  {
                    type: "GalleryImage",
                    props: { id: "work-3", image: { mediaId: "hero-photo", alt: "Hills at dusk" } },
                  },
                ],
              },
            },
            {
              // A video and a map that load only when the visitor clicks (F-CM-4, 2.8).
              type: "Video",
              props: {
                id: "baking",
                title: "A morning at the bakery",
                text: "<p>From the first dough to the first customer.</p>",
                address: "https://youtu.be/aqz-KE-bpKQ",
              },
            },
            {
              // Opening hours and contact details from Site Settings (2.8).
              type: "ContactDetails",
              props: { id: "visit", title: "Visit us", text: "<p>Pop in, or call ahead.</p>" },
            },
            {
              type: "Map",
              props: {
                id: "find-us",
                title: "Find us",
                text: "<p>On the high street, opposite the library.</p>",
                address: "1 High Street\nHightown\nHT1 2AB",
                variant: "split",
              },
            },
            {
              // A contact form posting to Formspree, and a newsletter signup (2.8).
              type: "ContactForm",
              props: { id: "write", title: "Write to us", askPhone: true },
            },
            {
              type: "Newsletter",
              props: {
                id: "news",
                title: "Our newsletter",
                action: "https://example.com/newsletter/signup",
              },
            },
            {
              // A signup whose form address isn't set yet: it draws, but can't send (2.8).
              type: "Newsletter",
              props: { id: "news-unset", title: "Cake club", action: "" },
            },
          ],
        },
      },
    ],
    settings: {
      "contact.address": "1 High Street\nHightown\nHT1 2AB",
      "contact.phone": "+44 1234 567890",
      "contact.email": "hello@rosas-bakery.example",
      "contact.openingHoursNote": "Closed on bank holidays.",
    },
    // Where the Contact form sends its messages (F-CM-1).
    formService: { kind: "formspree", formId: "xyzAbc12" },
    openingHours: [
      { days: ["tue", "wed", "thu", "fri"], opens: "07:00", closes: "15:00" },
      { days: ["sat", "sun"], opens: "08:00", closes: "13:00" },
    ],
    media: [{ id: "hero-photo", name: "hero", mimeType: "image/jpeg", data: heroPhoto() }],
    documents: [
      { id: "price-list", name: "price-list", mimeType: "application/pdf", data: priceList() },
    ],
    menu: {
      follows: "custom",
      items: [
        { id: menuId("home"), kind: "page", pageId: "home" as PageId, hidden: false },
        { id: menuId("about"), kind: "page", pageId: "about" as PageId, hidden: false },
        {
          id: menuId("visit"),
          kind: "group",
          label: "Visit us",
          hidden: false,
          children: [
            {
              id: menuId("questions"),
              kind: "section",
              label: "Questions",
              link: { kind: "page", pageId: "home" as PageId, anchor: "questions" },
              hidden: false,
            },
            {
              id: menuId("map"),
              kind: "link",
              label: "Find us",
              link: { kind: "url", href: "https://example.com/map", newTab: true },
              hidden: false,
            },
          ],
        },
        {
          id: menuId("order"),
          kind: "button",
          label: "Order a cake",
          link: { kind: "page", pageId: "about" as PageId },
          hidden: false,
        },
      ],
    },
  };
}

const menuId = (name: string) => name as MenuItemId;
