/** New Site (2.14a, F-SITE-1): the templates, their business types, and the themes to start in. */
export const templates = {
  // The New Site dialog (LF-11).
  "newSite.name": "Site name",
  "newSite.theme": "Theme",
  "newSite.blankHeading": "Start from scratch",
  "newSite.blank": "Blank site",
  "newSite.blankDescription": "One empty page, a Header and a Footer",
  "newSite.templatesHeading": "Templates",
  "newSite.category.all": "All",
  "newSite.sort": "Sort",
  "newSite.sort.name": "Name",
  "newSite.sort.category": "Business type",
  // A template's size: plural("newSite.pages", n).
  "newSite.pages.one": "{count} page",
  "newSite.pages.other": "{count} pages",
  "newSite.details": "Details",
  "newSite.detailsOf": "Details of {name}",
  "newSite.useTemplate": "Use this template",
  "newSite.create": "Create",
  "newSite.cancel": "Cancel",
  "newSite.noTemplates": "No templates of this type yet.",
  // The business types templates are grouped by (UX-29).
  "template.category.food": "Food and drink",
  "template.category.beauty": "Beauty",
  "template.category.trades": "Trades",
  "template.category.services": "Services",
  "template.category.creative": "Creative",
  "template.category.shop": "Shop",
  "template.category.personal": "Personal",
  // The templates, by id (packages/templates).
  "template.sample.name": "Sample bakery",
  "template.sample.description":
    "A bakery's home page and About page: a photo, what it offers, what customers say and an invitation to visit.",
  // The theme presets, by their names (packages/themes).
  "theme.preset.light": "Light",
  "theme.preset.dark": "Dark",
  "theme.preset.high-contrast-rounded": "High contrast",
  "theme.preset.bistro": "Bistro",
  "theme.preset.atelier": "Atelier",
  "theme.preset.workshop": "Workshop",
  "theme.preset.clarity": "Clarity",
} as const;
