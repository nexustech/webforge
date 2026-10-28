import type { OpeningHours, ThemeTokens } from "@webforge/model";
import { DEFAULT_THEME } from "@webforge/model";
import {
  type PageRecipe,
  recipesFor,
  type TemplateCategory,
  type TemplateId,
} from "@webforge/templates";
import {
  type BrandProposal,
  brandedTheme,
  brandFromImage,
  hexToOklch,
  THEME_PRESETS,
  themePreset,
} from "@webforge/themes";
import type { NewSiteRequest } from "../../shared/ipc/project.js";
import type { TemplateSummary } from "../../shared/ipc/templates.js";

/**
 * The colours the quick start's last step chose (QS-1): the theme's own, another preset's brand
 * colours fitted to it, those of the person's logo, or one brand colour of their own.
 */
export type QuickStartColours =
  | { readonly kind: "theme" }
  | { readonly kind: "palette"; readonly preset: string }
  | { readonly kind: "logo"; readonly proposal: BrandProposal }
  | { readonly kind: "colour"; readonly hex: string };

/** What the person answered in the quick start (QS-1, 3.11b); each step's answers can be left. */
export type QuickStartAnswers = {
  /** *Your business*: the business type, the name, and one line of what it does. */
  readonly category: TemplateCategory | null;
  readonly name: string;
  readonly whatYouDo: string;
  /** *A look*: the template, the theme preset. */
  readonly template: TemplateId | null;
  readonly theme: string;
  /** *Pages*: the template's pages left out, and the recipes ticked, by id. */
  readonly leaveOut: readonly string[];
  readonly recipes: readonly string[];
  /** *Colours and details*: the colours, then the optional contact details (QS-6). */
  readonly colours: QuickStartColours;
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly openingHours: readonly OpeningHours[];
  /** The site's web address (SEO-9), asked at the end so the export rarely has to. */
  readonly webAddress: string;
};

/** The answers before any is given: no type, the untitled name, the default theme. */
export function emptyAnswers(untitled: string): QuickStartAnswers {
  return {
    category: null,
    name: untitled,
    whatYouDo: "",
    template: null,
    theme: DEFAULT_THEME.preset,
    leaveOut: [],
    recipes: [],
    colours: { kind: "theme" },
    phone: "",
    email: "",
    address: "",
    openingHours: [],
    webAddress: "",
  };
}

/** The templates of business type `category`, or all of them while it isn't chosen. */
export const templatesOf = (
  templates: readonly TemplateSummary[],
  category: TemplateCategory | null,
) => (category === null ? templates : templates.filter((each) => each.category === category));

/** The page recipes the Pages step offers: the business type's, or none without a type. */
export const recipesOffered = (category: TemplateCategory | null): readonly PageRecipe[] =>
  category === null ? [] : recipesFor(category);

/**
 * The palettes the last step offers for `theme` (QS-1): three other presets' brand colours, fitted
 * to the theme's own surfaces as a logo's would be, so each stays readable on it. Different presets
 * from the theme's own, in the presets' order.
 */
export function palettesFor(theme: string): readonly string[] {
  return THEME_PRESETS.filter((preset) => preset.preset !== theme)
    .slice(0, 3)
    .map((preset) => preset.preset);
}

/** The brand colours `colours` give `theme`, or none for the theme's own. */
export function brandFor(
  colours: QuickStartColours,
  theme: ThemeTokens,
): BrandProposal | undefined {
  switch (colours.kind) {
    case "theme":
      return undefined;
    case "logo":
      return colours.proposal;
    case "colour": {
      const color = hexToOklch(colours.hex);
      return color === undefined ? undefined : brandFromImage([{ color, share: 1 }], theme);
    }
    case "palette": {
      const preset = themePreset(colours.preset);
      if (preset === undefined) return undefined;
      // The preset's own three, as an image with three colours would give them.
      const roles = ["primary", "secondary", "accent"] as const;
      return brandFromImage(
        roles.map((role, index) => ({ color: preset.colors[role], share: 3 - index })),
        theme,
      );
    }
  }
}

/** The theme the answers make: the preset, with the chosen brand colours on it. */
export function themeOf(answers: QuickStartAnswers): ThemeTokens {
  const theme = themePreset(answers.theme) ?? DEFAULT_THEME;
  const brand = brandFor(answers.colours, theme);
  return brand === undefined ? theme : brandedTheme(theme, brand);
}

/** Text without its ends' spaces, or nothing when nothing is left. */
const given = (text: string) => {
  const trimmed = text.trim();
  return trimmed === "" ? undefined : trimmed;
};

/**
 * New Site's request for the answers (QS-1): the name (or the untitled one), the template and
 * theme, the person's business in place of the template's sample (QS-2), the Pages step's choices
 * (QS-3) and the colours. What was left out stays the template's (QS-6).
 */
export function quickStartRequest(answers: QuickStartAnswers, untitled: string): NewSiteRequest {
  const name = given(answers.name) ?? untitled;
  const description = given(answers.whatYouDo);
  const phone = given(answers.phone);
  const email = given(answers.email);
  const address = given(answers.address);
  const webAddress = given(answers.webAddress);
  return {
    name,
    theme: answers.theme,
    ...(answers.template === null ? {} : { template: answers.template }),
    business: {
      ...(description === undefined ? {} : { description }),
      ...(phone === undefined ? {} : { phone }),
      ...(email === undefined ? {} : { email }),
      ...(address === undefined ? {} : { address }),
      ...(answers.openingHours.length === 0 ? {} : { openingHours: [...answers.openingHours] }),
      ...(webAddress === undefined ? {} : { webAddress }),
    },
    pages: { leaveOut: [...answers.leaveOut], recipes: [...answers.recipes] },
    ...(answers.colours.kind === "theme" ? {} : { themeTokens: themeOf(answers) }),
  };
}
