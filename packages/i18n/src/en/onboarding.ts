/** The tour and first-time tips (5.4a, OB-1…OB-7; `apps/desktop/src/renderer/onboarding/`). */
export const onboarding = {
  "command.tour": "Take the Tour",
  // The offer, the first time the editor opens a site made with the quick start (OB-1).
  "tour.offer.title": "Want a quick tour?",
  "tour.offer.text":
    "Three short steps: change your words, see your site as visitors will, and put it online.",
  "tour.offer.later": "You can take it any time from Help › Take the Tour.",
  "tour.offer.start": "Show me around",
  "tour.offer.notNow": "Not now",
  // The steps (OB-2), each beside the control it's about.
  "tour.region": "Tour: {title}",
  "tour.step": "Step {step} of {count}",
  "tour.words.title": "Change your words",
  "tour.words.text":
    "Click any text on your page, then press Enter or Edit on its bar, and type. Its options are in the Edit panel.",
  "tour.preview.title": "See it as visitors will",
  "tour.preview.text": "Preview shows your site in your browser, and on your phone.",
  "tour.publish.title": "Put it online",
  "tour.publish.text":
    "When you're ready, Publish puts your site on your web host. Site Check tells you first if anything needs fixing.",
  "tour.help.title": "Help is always here",
  "tour.help.text":
    "Press F1 for {appName} Help, or a ? button for help with what's beside it. Help › Take the Tour shows you around again.",
  "tour.learnMore": "Learn more: {page}",
  "tour.back": "Back",
  "tour.next": "Next",
  "tour.skip": "Skip tour",
  "tour.done": "Done",
  // First-time tips (OB-4), each shown once, the first time the person reaches its place.
  "tip.label": "Tip",
  "tip.gotIt": "Got it",
  "tip.selection.title": "Change what you've selected",
  "tip.selection.text":
    "Press Enter, or Edit on its bar, to change its text. The bar also moves, hides, copies and deletes it.",
  "tip.contentMode.title": "Content mode",
  "tip.contentMode.text":
    "Content mode locks the layout, so you can change the words and pictures without moving anything.",
  "tip.mustFix.title": "Must fix",
  "tip.mustFix.text": "A Must fix stops Export and Publish until it's fixed. Click it to go there.",
  "tip.export.title": "Your website is a folder",
  "tip.export.text":
    "Your website is a folder of files. Upload all of it to your web host, keeping the folders as they are.",
  "tip.themeStudio.title": "Themes change every page",
  "tip.themeStudio.text": "A theme changes every page at once. Undo takes it back.",
  // Settings › Interface (OB-5).
  "settings.interface.showTips": "Show tips",
  "settings.interface.showTipsHelp":
    "A short tip the first time you reach some parts of {appName}, each shown once.",
  "settings.interface.showAgain": "Show the tour and tips again",
  "settings.interface.showAgainHelp":
    "The tour is offered when a site next opens, and each tip shows once more.",
} as const;
