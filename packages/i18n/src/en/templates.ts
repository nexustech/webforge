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
  // The quick start (QS-1, 3.11b): four steps, each optional, then the site.
  "quickStart.title": "Start a site",
  "quickStart.description":
    "A few questions, each one optional. You can change every answer later.",
  "quickStart.steps": "Steps",
  "quickStart.step.business": "Your business",
  "quickStart.step.look": "A look",
  "quickStart.step.pages": "Pages",
  "quickStart.step.details": "Colours and details",
  "quickStart.stepOf": "Step {step} of {count}",
  "quickStart.back": "Back",
  "quickStart.next": "Next",
  "quickStart.create": "Create site",
  "quickStart.cancel": "Cancel",
  "quickStart.chooseTemplate": "Choose a template yourself",
  // Your business.
  "quickStart.businessType": "What kind of business is it?",
  "quickStart.name": "Business or site name",
  "quickStart.whatYouDo": "What you do",
  "quickStart.whatYouDoHint":
    "One line, such as “Bread and cakes, baked every morning”. Search engines show it under your site's name.",
  // A look.
  "quickStart.templates": "Templates",
  "quickStart.templatesFor": "Templates for {type}",
  "quickStart.exampleText": "Want to look around first? Open a finished {name} site to explore.",
  "quickStart.tryExample": "Try an example",
  "quickStart.theme": "Theme",
  // Pages.
  "quickStart.pagesText":
    "Untick a page to leave it out. You can add pages later in the Pages panel.",
  "quickStart.templatePages": "Pages in {name}",
  "quickStart.blankPages": "A Blank site has Home, About and Contact pages.",
  "quickStart.homePage": "{title} (home page)",
  "quickStart.suggested": "More pages for {type}",
  "quickStart.noType": "Choose a business type on the first step to see pages suggested for it.",
  // Colours and details.
  "quickStart.colours": "Colours",
  "quickStart.colours.theme": "The theme's own",
  "quickStart.colours.logo": "From my logo…",
  "quickStart.colours.logoChosen": "From my logo",
  "quickStart.colours.logoHint":
    "Colours are taken from the picture on this computer. The picture isn't added to the site.",
  "quickStart.colours.unreadable": "That picture couldn't be read. Try a PNG, JPEG or WebP file.",
  "quickStart.colours.noColours": "No colours could be found in that picture. Try another one.",
  "quickStart.colours.colour": "My brand colour",
  "quickStart.details": "Contact details",
  "quickStart.detailsText":
    "Optional. Anything left empty keeps the template's sample, which Site Check points out before you publish.",
  "quickStart.searchNote":
    "{appName} writes these details into the site so search engines can show them. With the web address, it adds a sitemap too.",
  // The business types templates are grouped by (UX-29).
  "template.category.food": "Food and drink",
  "template.category.beauty": "Beauty",
  "template.category.trades": "Trades",
  "template.category.services": "Services",
  "template.category.creative": "Creative",
  "template.category.shop": "Shop",
  "template.category.personal": "Personal",
  // The page recipes each business type offers (QS-3, 3.11a): Add Page's suggestions, and the
  // quick start's Pages step. Each names the page its recipe makes.
  "recipe.food-events": "Events",
  "recipe.food-private-hire": "Private hire",
  "recipe.food-reviews": "Reviews",
  "recipe.beauty-prices": "Prices",
  "recipe.beauty-reviews": "Reviews",
  "recipe.beauty-gift-vouchers": "Gift vouchers",
  "recipe.trades-reviews": "Reviews",
  "recipe.trades-areas": "Areas we cover",
  "recipe.trades-faq": "FAQ",
  "recipe.services-how-we-work": "How we work",
  "recipe.services-client-stories": "Client stories",
  "recipe.services-faq": "FAQ",
  "recipe.creative-kind-words": "Kind words",
  "recipe.creative-workshops": "Workshops",
  "recipe.creative-faq": "FAQ",
  "recipe.shop-delivery": "Delivery and returns",
  "recipe.shop-reviews": "Reviews",
  "recipe.shop-faq": "FAQ",
  "recipe.personal-services": "Services",
  "recipe.personal-kind-words": "Kind words",
  // The templates, by id (packages/templates).
  "template.consultant.name": "Consultant",
  "template.consultant.description":
    "An adviser's site: what they help with, what clients say, services and prices with questions answered, their story and a contact form.",
  "template.photographer.name": "Photographer / Portfolio",
  "template.photographer.description":
    "A photographer's site: a full-width photo, recent work, a portfolio gallery, sessions and prices, their story and a contact form.",
  "template.shop.name": "Shop",
  "template.shop.description":
    "A small shop's site: bestsellers with Buy buttons, why to buy, a page of products, the makers' story, opening hours and a contact form.",
  "template.personal.name": "Personal / CV",
  "template.personal.description":
    "A freelancer's site: a portrait, what they do and what clients say, their experience, a gallery of work and a contact form.",
  "template.cafe.name": "Café / Restaurant",
  "template.cafe.description":
    "A café's site: a photo, why people come back, food from the counter, what regulars say, the menu with prices, its story and how to find it.",
  "template.salon.name": "Salon / Beauty",
  "template.salon.description":
    "A salon's site: what it does, recent work and kind words, treatments and prices with questions answered, the team and a booking form.",
  "template.trades.name": "Trades",
  "template.trades.description":
    "A tradesperson's site: why choose them, what they do with fixed prices, a gallery of jobs, the team and a form for a free quote.",
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
  "theme.preset.meridian": "Meridian",
  "theme.preset.darkroom": "Darkroom",
  "theme.preset.market": "Market",
  "theme.preset.gazette": "Gazette",
  "theme.preset.harbour": "Harbour",
  "theme.preset.linen": "Linen",
  "theme.preset.studio": "Studio",
  "theme.preset.playground": "Playground",
} as const;
