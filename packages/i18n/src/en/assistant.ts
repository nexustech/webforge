/** The assistant's panel (`apps/desktop/src/renderer/assistant/`, 6.9c, AIA-5…AIA-8, ADR 0026). */
export const assistant = {
  // A link in a reply (product/14 §6.4): its address is always shown, and it opens only when clicked.
  "assistant.link.open": "Open {address} in your browser",
  "assistant.image": "Image not shown: {alt}",
  // This month's spend, in US dollars as OpenRouter bills (AIA-8).
  "assistant.month": "This month: {spent} of {limit}",
  "assistant.month.warning": "This month: {spent} of {limit}, over 80% of your limit",
  "assistant.month.reached": "This month's limit of {limit} is reached",
  // Consent (product/14 §5.3, AIA-6, ADR 0026 §4): the app's once, then each site's.
  "assistant.consent.title": "Turn on the assistant?",
  "assistant.consent.description":
    "Read what the assistant sends, and to whom, before you turn it on.",
  "assistant.consent.sent":
    "When you send the assistant a message, {appName} sends it to an AI model with the parts of your site it needs to answer: the text and settings of the page and sections involved, and your business details when you ask about them. Images and files aren't sent.",
  "assistant.consent.receivers": "{receivers} receive it.",
  "assistant.consent.retention":
    "{appName} asks for providers that don't keep your requests or train on them. OpenRouter stores what you send only if you turn that on in your OpenRouter account. The makers of {appName} receive nothing.",
  "assistant.consent.pays":
    "Your own OpenRouter account pays. {appName} shows each reply's cost and stops at the monthly limit you set.",
  "assistant.consent.server": "It goes to the server at {host}, which you chose.",
  "assistant.consent.local": "Nothing leaves this computer: the model runs on it.",
  "assistant.consent.people":
    "If your site holds other people's details, such as names in testimonials, staff or contact details, they may be sent when the assistant works on those sections. Don't ask it to work on anything you wouldn't put on your public site.",
  "assistant.consent.off":
    "Preferences › Assistant › Turn Off stops it at once and deletes its key from this computer.",
  "assistant.consent.perSite":
    "The first time you use it on each site, {appName} asks again. Your answer stays on this computer, never in the site file.",
  "assistant.consent.agree": "Turn On",
  "assistant.consent.cancel": "Cancel",
  "assistant.consent.openRouterAndMaker": "OpenRouter and {maker}",
  "assistant.consent.openRouterAndModelMaker": "OpenRouter and the model's maker",
  "assistant.site.title": "Use the assistant on {site}?",
  "assistant.site.sent": "Its content will be sent to {receivers} when you send a message.",
  "assistant.site.kept": "Your answer stays on this computer, never in the site file.",
  "assistant.site.allow": "Use on This Site",
  "assistant.site.deny": "Not Now",
} as const;
