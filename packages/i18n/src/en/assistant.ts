/** The assistant's panel (`apps/desktop/src/renderer/assistant/`, 6.9c, AIA-5…AIA-8, ADR 0026). */
export const assistant = {
  "assistant.conversation": "Conversation with the assistant",
  "assistant.you": "You",
  "assistant.name": "Assistant",
  "assistant.empty":
    "Ask the assistant to change your site, for example “Make the Hero's title shorter”.",
  "assistant.replying": "Replying…",
  // A link in a reply (product/14 §6.4): its address is always shown, and it opens only when clicked.
  "assistant.link.open": "Open {address} in your browser",
  "assistant.image": "Image not shown: {alt}",
  // Main opens only a web address the reply holds (ADR 0026 §7).
  "assistant.link.refused": "This link can't be opened from here.",
  "assistant.link.failed": "The link couldn't be opened. Try again.",
  // What a reply did, besides its text.
  "assistant.tool.running": "Working on your site…",
  "assistant.tool.read.one": "Looked at 1 part of your site",
  "assistant.tool.read.other": "Looked at {count} parts of your site",
  "assistant.tool.refused": "A change wasn't allowed here.",
  "assistant.tool.declined": "You said no to a change.",
  "assistant.tool.busy": "A change waited while you were editing.",
  "assistant.tool.invalid": "A change didn't fit the site, so it wasn't made.",
  "assistant.tool.failed": "A change couldn't be made.",
  "assistant.steps": "Changes in this reply",
  // Why a reply stopped before it ended by itself (ADR 0026 §5).
  "assistant.stop.stopped": "You stopped this reply.",
  "assistant.stop.tool-cap": "Stopped: a reply can make at most 25 changes or lookups.",
  "assistant.stop.model-call-cap": "Stopped: this reply took too many steps.",
  "assistant.stop.max-tokens": "Stopped: the reply was too long.",
  "assistant.stop.limit-reached": "Stopped: this month's limit is reached.",
  // Why a message wasn't sent, or a reply failed (ADR 0026 §7). Never the provider's own text.
  "assistant.error.consent-needed": "The assistant needs your yes before it can work on this site.",
  "assistant.error.not-signed-in": "Sign in to OpenRouter in Settings › Assistant first.",
  "assistant.error.no-model": "Choose a model in Settings › Assistant first.",
  "assistant.error.limit-reached":
    "This month's limit is reached. Raise it in Settings › Assistant, or wait for next month.",
  "assistant.error.busy": "The assistant is still replying. Wait for it, or stop it.",
  "assistant.error.no-site": "Open a site to use the assistant.",
  "assistant.error.offline": "The assistant couldn't be reached. Check your internet connection.",
  "assistant.error.unauthorized":
    "OpenRouter didn't accept the sign-in. Sign in again in Settings › Assistant.",
  "assistant.error.no-credit": "Your OpenRouter account has run out of credit.",
  "assistant.error.rate-limited": "Too many messages at once. Try again in a minute.",
  "assistant.error.model-unavailable":
    "The model you chose isn't available now. Try again later, or choose another.",
  "assistant.error.provider-error": "The assistant's provider couldn't answer. Try again.",
  "assistant.error.failed": "Something went wrong. Try again.",
  // Cost, in US dollars as OpenRouter bills (AIA-8).
  "assistant.cost.reply": "This reply cost {cost}",
  "assistant.cost.free": "No cost shown for this reply",
  // This month's spend, in US dollars as OpenRouter bills (AIA-8).
  "assistant.month": "This month: {spent} of {limit}",
  "assistant.month.warning": "This month: {spent} of {limit}, over 80% of your limit",
  "assistant.month.reached": "This month's limit of {limit} is reached",
  // The review card after a reply that changed the site (AIA-5, WF-2).
  "assistant.review.title.one": "This reply made 1 change",
  "assistant.review.title.other": "This reply made {count} changes",
  "assistant.review.show": "Show {change} on the page",
  "assistant.review.links": "Links to other websites",
  "assistant.review.keep": "Keep",
  "assistant.review.undo": "Undo These Changes",
  "assistant.review.undone": "These changes are undone. Redo brings them back.",
  "assistant.review.movedOn":
    "Other changes have been made since. To take back everything the assistant changed, restore the version saved before its changes.",
  "assistant.review.versions": "Open Version History",
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
    "Settings › Assistant › Turn Off stops it at once and deletes its key from this computer.",
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
  "assistant.site.stop": "Stop Using on This Site",
  // A key that would go over plain http:// to another computer (ADR 0026 §7, #976).
  "assistant.error.insecure-server":
    "The server's address starts with http://, so your key and your site's text would travel unencrypted. Use an https:// address in Settings › Assistant, or a server on this computer.",
  // The panel (6.9c, UX-28).
  "assistant.panel": "Assistant",
  "assistant.loading": "Loading…",
  "assistant.off": "The assistant is off. Set it up to ask it to change your site.",
  "assistant.setUp": "Set Up the Assistant…",
  "assistant.reconsent":
    "The assistant now sends your requests somewhere new. Read where before you turn it on again.",
  "assistant.siteDenied": "You chose not to use the assistant on this site.",
  "assistant.newConversation": "New Conversation",
  "assistant.message": "Message the assistant",
  "assistant.messagePlaceholder": "Ask for a change, such as “Make the Hero's title shorter”",
  "assistant.send": "Send",
  "assistant.stop": "Stop",
  // Settings › Assistant and its dialog (6.9c, AIA-6, AIA-8).
  "assistant.settings.title": "Assistant",
  "assistant.settings.line":
    "An AI model that changes your site when you ask. It's off until you turn it on.",
  "assistant.settings.open": "Assistant Settings…",
  "assistant.settings.description":
    "Turn the assistant on or off, choose where its requests go, and set how much it may spend each month.",
  "assistant.settings.on": "The assistant is on",
  "assistant.settings.off": "The assistant is off",
  "assistant.settings.onHint": "Turn Off stops it at once and deletes its key from this computer.",
  "assistant.settings.offHint":
    "Turning it on shows what it sends, and to whom, before anything is sent.",
  "assistant.settings.turnOn": "Turn On…",
  "assistant.settings.turnOff": "Turn Off",
  "assistant.settings.limit": "Monthly limit",
  "assistant.settings.limitField": "Limit in US dollars",
  "assistant.settings.setLimit": "Set Limit",
  "assistant.settings.limitHint":
    "Between $1 and $1,000. You're told at 80%, and the assistant stops at the limit until next month.",
  "assistant.settings.close": "Close",
  // Where requests go, and signing in (ADR 0026 §2–§3).
  "assistant.provider.title": "Where requests go",
  "assistant.provider.openrouter": "OpenRouter",
  "assistant.provider.openrouter.hint":
    "An online service with many AI models. Your own OpenRouter account pays.",
  "assistant.provider.ollama": "Ollama on this computer",
  "assistant.provider.ollama.hint":
    "A model running on this computer with Ollama: nothing leaves it.",
  "assistant.provider.lmstudio": "LM Studio on this computer",
  "assistant.provider.lmstudio.hint":
    "A model running on this computer with LM Studio: nothing leaves it.",
  "assistant.provider.server": "Another server",
  "assistant.provider.server.hint": "A server you name that offers AI models.",
  "assistant.provider.address": "Server address",
  "assistant.provider.addressPlaceholder": "https://",
  "assistant.provider.addressHint": "Enter the server's web address, starting with https://.",
  "assistant.provider.unencrypted":
    "This address starts with http://, so it's unencrypted: no key will be sent to it. Use https:// if the server needs a key.",
  "assistant.provider.useServer": "Use This Server",
  "assistant.provider.key": "Key for this server, if it needs one",
  "assistant.provider.keyReplace": "A new key for this server",
  "assistant.provider.saveKey": "Save Key",
  "assistant.signIn.browser": "Sign In with OpenRouter…",
  "assistant.signIn.code": "Sign In with a Code…",
  "assistant.signIn.waiting": "Finish signing in in your browser.",
  "assistant.signIn.cancel": "Cancel",
  "assistant.signIn.codeField": "The code OpenRouter shows",
  "assistant.signIn.finish": "Sign In",
  "assistant.signIn.done": "Signed in to OpenRouter.",
  "assistant.signIn.signed-in": "Signed in.",
  "assistant.signIn.cancelled": "Sign-in cancelled.",
  "assistant.signIn.timed-out": "Signing in took too long. Try again.",
  "assistant.signIn.refused": "That wasn't accepted. Check it and try again.",
  "assistant.signIn.keychain-unavailable":
    "This computer can't keep the key safely, so the assistant can't sign in here.",
  "assistant.signIn.offline": "The provider couldn't be reached. Check your internet connection.",
  "assistant.signIn.insecure-server":
    "The server's address starts with http://, so the key would travel unencrypted. Use an https:// address, or a server on this computer.",
  "assistant.signIn.failed": "Signing in didn't work. Try again.",
  // Which model answers (AIA-1, AIA-7, AIA-8, ADR 0026 §2).
  "assistant.model.title": "Model",
  "assistant.model.field": "The model that answers",
  "assistant.model.none": "Choose a model",
  "assistant.model.signInFirst": "Sign in to OpenRouter to choose a model.",
  "assistant.model.perReply": "about {cost} a reply",
  "assistant.model.tested": "tested",
  "assistant.model.priceyTitle": "Use a costlier model?",
  "assistant.model.priceyBody":
    "{model} costs about {cost} a reply, more than most. Your monthly limit still applies.",
  "assistant.model.usePricey": "Use This Model",
  "assistant.model.cancel": "Cancel",
  "assistant.model.advanced": "Advanced",
  "assistant.model.allowRetaining": "Allow models that may keep requests",
  "assistant.model.allowRetainingHint":
    "Off: only models whose providers don't keep or train on what you send.",
  "assistant.model.retainingTitle": "Allow models that may keep requests?",
  "assistant.model.retainingBody":
    "With these models, the model's maker may keep what you send, your site's text included, or use it to train its models.",
  "assistant.model.allowRetainingConfirm": "Allow Them",
  "assistant.model.openRouterKey": "An OpenRouter key, instead of signing in",
} as const;
