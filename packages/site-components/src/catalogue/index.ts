import { t } from "@webforge/i18n";
import type { LayoutDoc, PageDoc } from "@webforge/model";
import { createLibrary } from "../define.js";
import type { ComponentLibrary } from "../library.js";
import { basicComponents } from "./basic.js";
import { carouselComponents } from "./carousel.js";
import { contactDetailsComponents } from "./contact-details.js";
import { elementsComponents } from "./elements.js";
import { embedsComponents } from "./embeds.js";
import { featuresComponents } from "./features.js";
import { formsComponents } from "./forms.js";
import { galleryComponents } from "./gallery.js";
import { layoutComponents } from "./layout.js";
import { sectionsComponents } from "./sections.js";
import { teamComponents } from "./team.js";
import { testimonialsComponents } from "./testimonials.js";

/**
 * Webforge's site components (daisyUI 5 markup), one module per family: the MVP catalogue
 * (spec/02 §3) grows by adding a module here, which keeps streams adding components from
 * touching one file. Header and Footer live in the shared layout (C5); the rest go on pages.
 * `docs/components.md` describes how to write one.
 */
export const siteLibrary: ComponentLibrary = createLibrary(
  layoutComponents,
  basicComponents,
  elementsComponents,
  sectionsComponents,
  galleryComponents,
  carouselComponents,
  embedsComponents,
  contactDetailsComponents,
  formsComponents,
  featuresComponents,
  testimonialsComponents,
  teamComponents,
);

/** The page a new site starts with. */
export function starterPage(): PageDoc {
  return {
    root: { props: {} },
    content: [
      {
        type: "Section",
        props: {
          id: "section-1",
          padding: { top: "m", bottom: "m" },
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
          padding: { top: "l", bottom: "l" },
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
