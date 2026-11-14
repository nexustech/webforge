/** New Site (2.14a, F-SITE-1): the templates, their business types, and the themes to start in. */
export const templates = {
  // The note that opens the Privacy, Terms and Cookies pages Add Page writes (#855, #866): an
  // instruction to the owner, which Site Check finds if it's left in.
  "legalPage.note":
    "This page is a starting point, not legal advice. Check that each part matches how your business works, change what doesn't, then delete this paragraph.",
  // The privacy page *Add Page › Privacy Page* adds (#855): a start for the owner to check, in
  // their voice to visitors.
  "privacyPage.title": "Privacy",
  "privacyPage.description": "How this site uses the details you give it, and your rights.",
  "privacyPage.whoTitle": "Who we are",
  "privacyPage.who": "This website is run by {business}.",
  "privacyPage.collectsTitle": "What we collect",
  "privacyPage.collectsMessages":
    "When you send us a message through this site, we receive what you write, with the name, email address and phone number you give us.",
  "privacyPage.collectsSignups":
    "When you sign up for our newsletter, we keep the email address and name you give us, to send it to you.",
  "privacyPage.collectsVisitsConsent":
    "If you agree when this site asks, Google Analytics counts your visit, so we can see which pages people read. It doesn't tell us who you are.",
  "privacyPage.collectsVisitsCookieless":
    "Google Analytics counts visits to this site, without cookies, so we can see which pages people read. It doesn't tell us who you are.",
  "privacyPage.collectsNothing": "This site doesn't ask for your details or count your visits.",
  "privacyPage.whyTitle": "Why we collect it",
  "privacyPage.whyDetails":
    "We use the details you give us only to reply to you and to send you what you asked for.",
  "privacyPage.whyVisits":
    "We use visit counts only to make this site better. Google handles them for us.",
  "privacyPage.whyNotSold": "We don't sell your details or use them for advertising.",
  "privacyPage.keepTitle": "How long we keep it",
  "privacyPage.keepMessages":
    "We keep your messages for as long as we need them to help you, then delete them.",
  "privacyPage.keepSignups": "We keep your newsletter sign-up until you unsubscribe.",
  "privacyPage.keepVisits":
    "Google Analytics keeps visit counts for as long as our account is set to keep them.",
  "privacyPage.rightsTitle": "Your rights",
  "privacyPage.rights":
    "You can ask us what details we hold about you, and ask us to correct them or delete them.",
  "privacyPage.contactTitle": "Contact us",
  "privacyPage.contactEmail": "To ask about your details, email us at {email}.",
  "privacyPage.contactNoEmail":
    "To ask about your details, contact us using the details on this site.",
  // The terms page *Add Page › Terms Page* adds (#866): a start for the owner to check.
  "termsPage.title": "Terms",
  "termsPage.description": "The terms for using this site and for booking or buying from us.",
  "termsPage.whoTitle": "Who we are",
  "termsPage.who": "This website is run by {business}.",
  "termsPage.address": "Our address is {address}.",
  "termsPage.useTitle": "Using this site",
  "termsPage.use":
    "The information on this site is for general guidance. We keep it as accurate and up to date as we can, but it can change without notice.",
  "termsPage.useCopy":
    "The words and photos on this site are ours or used with permission. Please don't copy them without asking us first.",
  "termsPage.pricesTitle": "Prices and bookings",
  "termsPage.prices":
    "Prices on this site are a guide and can change. We confirm the price, and any terms that apply, before you book or buy.",
  "termsPage.linksTitle": "Links to other sites",
  "termsPage.links":
    "Where this site links to other websites, we don't control them and aren't responsible for what they say.",
  "termsPage.changesTitle": "Changes to these terms",
  "termsPage.changes":
    "We may update these terms from time to time. The version on this page is the one that applies.",
  "termsPage.contactTitle": "Contact us",
  "termsPage.contactEmail": "If you have a question about these terms, email us at {email}.",
  "termsPage.contactPhone": "If you have a question about these terms, call us on {phone}.",
  "termsPage.contactOther":
    "If you have a question about these terms, contact us using the details on this site.",
  // The cookie policy *Add Page › Cookie Policy Page* adds while Google Analytics is on (#866).
  "cookiePage.title": "Cookies",
  "cookiePage.description": "The cookies this site uses, and how to change your choice.",
  "cookiePage.whatTitle": "What cookies are",
  "cookiePage.what":
    "Cookies are small files a website keeps in your browser, so it can recognise your browser when you come back.",
  "cookiePage.oursTitle": "The cookies this site uses",
  "cookiePage.analyticsConsent":
    "If you agree when this site asks, Google Analytics sets cookies named _ga and _ga_ followed by a code, so we can count visits and see which pages people read. They last up to two years. If you don't agree, it sets none.",
  "cookiePage.analyticsCookieless":
    "Google Analytics counts visits to this site without cookies. This site doesn't set any cookies of its own.",
  "cookiePage.none": "This site doesn't set any cookies.",
  "cookiePage.choiceKept":
    "Your browser remembers your choice, so this site doesn't ask on every page. It isn't sent to us.",
  "cookiePage.embedsTitle": "Videos and maps",
  "cookiePage.embedsConsent":
    "Videos and maps from other sites, such as YouTube, Vimeo and Google Maps, load only when you click them, or when you choose {acceptAll} when this site asks. Those sites may then set their own cookies.",
  "cookiePage.embedsClick":
    "Videos and maps from other sites, such as YouTube, Vimeo and Google Maps, load only when you click them. Those sites may then set their own cookies.",
  "cookiePage.changeTitle": "Changing your choice",
  "cookiePage.changeSettings": "To change your choice, click {settings} at the bottom of any page.",
  "cookiePage.changeBrowser": "You can also see and delete cookies in your browser's settings.",
  "cookiePage.contactTitle": "Contact us",
  "cookiePage.contactEmail": "If you have a question about cookies, email us at {email}.",
  "cookiePage.contactOther":
    "If you have a question about cookies, contact us using the details on this site.",
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
  "quickStart.about": "Tell us about your business",
  "quickStart.aboutHint":
    "A few sentences: what you offer, who for, and what makes you different. Once your site opens, the assistant writes its home and About pages' words from this, for you to check.",
  // A look.
  "quickStart.templates": "Templates",
  "quickStart.templatesFor": "Templates for {type}",
  "quickStart.exampleText": "Want to look around first? Open a finished {name} site to explore.",
  "quickStart.tryExample": "Try an example",
  "quickStart.theme": "Theme",
  // Pages.
  "quickStart.layout": "How your site is laid out",
  "quickStart.layout.pages": "Separate pages",
  "quickStart.layout.pagesHint": "Each page has its own address, and a link in the menu.",
  "quickStart.layout.onePage": "One page",
  "quickStart.layout.onePageHint":
    "Everything on your home page, one section after another. The menu scrolls to each.",
  "quickStart.pagesText":
    "Untick a page to leave it out. You can add pages later in the Pages panel.",
  "quickStart.onePageText":
    "Untick a page to leave it out. Each page you keep becomes a section of your home page, in this order, with a link to it in the menu.",
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
