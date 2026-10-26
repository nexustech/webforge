/** New Site (2.14a, F-SITE-1): the templates, their business types, and the themes to start in. */
export const templates = {
  // The New Site dialog (LF-11).
  "newSite.title": "New Site",
  "newSite.description":
    "Name your site, choose a theme, and start from scratch or from a template.",
  "newSite.name": "Site name",
  "newSite.theme": "Theme",
  "newSite.blankHeading": "Start from scratch",
  "newSite.blank": "Blank site",
  "newSite.blankDescription": "Home, About and Contact pages, ready for your words",
  "newSite.templatesHeading": "Templates",
  "newSite.categories": "Business type",
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
  "template.personal.name": "Personal / CV",
  "template.personal.description":
    "A freelancer's site: a portrait, what they do and what clients say, their experience, a gallery of work and a contact form.",
  "template.blank.name": "Blank site",
  "template.blank.description":
    "Home, About and Contact pages, each a heading and a line of text to replace.",
  // The theme presets, by their names (packages/themes).
  "theme.preset.light": "Light",
  "theme.preset.dark": "Dark",
  "theme.preset.high-contrast-rounded": "High contrast",
  "theme.preset.bistro": "Bistro",
  "theme.preset.atelier": "Atelier",
  "theme.preset.workshop": "Workshop",
  "theme.preset.clarity": "Clarity",
  "theme.preset.harbour": "Harbour",
  "theme.preset.linen": "Linen",
  "theme.preset.studio": "Studio",
  "theme.preset.playground": "Playground",
} as const;
