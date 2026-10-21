import { t } from "@webforge/i18n";
import type { LayoutDoc, PageDoc } from "@webforge/model";
import { heading, section, text } from "./components/basic.js";
import { footer, header } from "./components/layout.js";
import { faq, faqItem, hero } from "./components/sections.js";
import type { ComponentLibrary } from "./library.js";

/**
 * Webforge's site components (daisyUI 5 markup). The MVP catalogue (spec/02 §3) grows from here.
 * Header and Footer live in the shared layout (C5); the rest go on pages.
 */
export const siteLibrary: ComponentLibrary = {
  components: {
    Header: header,
    Footer: footer,
    Section: section,
    Hero: hero,
    Faq: faq,
    FaqItem: faqItem,
    Heading: heading,
    Text: text,
  },
};

/** The page a new site starts with. */
export function starterPage(): PageDoc {
  return {
    root: { props: {} },
    content: [
      {
        type: "Section",
        props: {
          id: "section-1",
          padding: "medium",
          content: [
            {
              type: "Heading",
              props: { id: "heading-1", text: t("starter.heading"), size: "large" },
            },
            { type: "Text", props: { id: "text-1", text: `<p>${t("starter.text")}</p>` } },
          ],
        },
      },
    ],
  };
}

/**
 * The "Page not found" page a new site starts with (F-ED-20): a heading and a pointer to the
 * menu. No links of its own, so nothing breaks when hosts serve it at any missing address.
 */
export function starterNotFoundPage(): PageDoc {
  return {
    root: { props: {} },
    content: [
      {
        type: "Section",
        props: {
          id: "section-1",
          padding: "large",
          content: [
            {
              type: "Heading",
              props: { id: "heading-1", text: t("starter.notFoundHeading"), size: "large" },
            },
            { type: "Text", props: { id: "text-1", text: `<p>${t("starter.notFoundText")}</p>` } },
          ],
        },
      },
    ],
  };
}

/** The Header and Footer a new site starts with. */
export function starterLayout(siteName: string): LayoutDoc {
  return {
    // The site name shows Site Settings' name, so renaming the site renames it everywhere (1.17).
    header: [
      { type: "Header", props: { id: "header", siteName, bindings: { siteName: "general.name" } } },
    ],
    footer: [{ type: "Footer", props: { id: "footer", text: t("starter.footer") } }],
  };
}
