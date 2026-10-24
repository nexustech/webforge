import type { ThemeTokens } from "@webforge/model";
import { __unstable__loadDesignSystem } from "tailwindcss";
import { type StyleResources, siteStylesheetSource, tailwindLoaders } from "./css.js";

/**
 * Every class a site's styles support, for the Edit panel's CSS classes field (#276): Tailwind's
 * utilities and daisyUI's components, with the site's own theme colours (`bg-primary`,
 * `text-base-content`), and the variants that go in front of them (`md:`, `hover:`).
 */
export type ClassCatalogue = {
  readonly classes: readonly string[];
  /** Variant names that take no value, written before a class with a colon (`md`, `hover`). */
  readonly variants: readonly string[];
  /** The CSS each class produces, or `null` for one that produces none (a typo, or a custom class). */
  readonly cssFor: (classes: readonly string[]) => (string | null)[];
};

/** A variant that can be typed as it is: letters, digits and dashes (not `*` or `[…]`). */
const PLAIN_VARIANT = /^[a-z][a-z0-9-]*$/;

/**
 * Loads the catalogue for a site with `theme`, from the same stylesheet and plugins as its CSS
 * (`buildSiteCss`). This is the one place that uses Tailwind's `__unstable__loadDesignSystem`, which
 * may change in any Tailwind release: `class-catalogue.test.ts` fails if it does. If it goes away,
 * the fallback is a list written at build time by a `tools/` script.
 */
export async function loadClassCatalogue(
  resources: StyleResources,
  theme: ThemeTokens,
): Promise<ClassCatalogue> {
  const design = await __unstable__loadDesignSystem(
    siteStylesheetSource({ theme, candidates: [], fontsUrl: "" }),
    tailwindLoaders(resources),
  );
  return {
    classes: design.getClassList().map(([name]) => name),
    variants: design
      .getVariants()
      .filter((variant) => !variant.isArbitrary && PLAIN_VARIANT.test(variant.name))
      .map((variant) => variant.name),
    cssFor: (classes) => design.candidatesToCss([...classes]),
  };
}
