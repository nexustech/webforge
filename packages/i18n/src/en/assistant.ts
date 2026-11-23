/** The assistant's panel (`apps/desktop/src/renderer/assistant/`, 6.9c, AIA-5…AIA-8, ADR 0026). */
export const assistant = {
  "assistant.conversation": "Conversation with the assistant",
  "assistant.you": "You",
  "assistant.name": "Assistant",
  // The version saved before a conversation's first change (S20, ADR 0026 §1).
  "assistant.version.before": "Before the assistant's changes",
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
  // Changes a reply couldn't make when they were applied, as the site had changed (6.9e).
  "assistant.review.refused.one": "1 change couldn't be made, as the page has changed since:",
  "assistant.review.refused.other":
    "{count} changes couldn't be made, as the page has changed since:",
  // Review before applying (AIA-5, 6.9e): a reply's changes held until the person applies them.
  "assistant.held.title.one": "1 change is waiting for you",
  "assistant.held.title.other": "{count} changes are waiting for you",
  "assistant.held.description": "Nothing on your site has changed yet.",
  "assistant.held.apply": "Apply Changes",
  "assistant.held.applying": "Applying…",
  "assistant.held.discard": "Discard",
  "assistant.held.discarded": "These changes were discarded. Your site is as it was.",
  "assistant.held.unavailable": "These changes aren't available any more. Your site is as it was.",
  "assistant.held.replaced":
    "These changes were dropped when you sent a new message. Your site is as it was.",
  // Consent (product/14 §5.3, AIA-6, ADR 0026 §4): the app's once, then each site's.
  "assistant.consent.title": "Turn On the Assistant?",
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
  // OpenRouter's sign-in (ADR 0026 §3): the key's label in the person's account, never the
  // computer's name, and the page the browser shows after it.
  "assistant.signIn.keyLabel": "{appName}, {date}",
  "assistant.signIn.donePageTitle": "Signed in to OpenRouter",
  "assistant.signIn.donePage": "You're signed in. You can close this tab and go back to {appName}.",
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
  // Things You Can Ask (5.21, OL-8): example requests to try, each one the assistant's tools can
  // carry out (`apps/desktop/src/renderer/assistant/assistant-examples.ts`).
  "assistant.examples.open": "Things You Can Ask…",
  "command.assistantExamples": "Things You Can Ask the Assistant…",
  "assistant.examples.title": "Things You Can Ask",
  "assistant.examples.description":
    "Examples of what you can ask the assistant. Try one to put it in the assistant's box, where you can change it before you send it.",
  "assistant.examples.search": "Search the examples",
  "assistant.examples.none": "No examples have “{query}” in them.",
  "assistant.examples.try": "Try It",
  "assistant.examples.tryLabel": "Try “{example}”",
  "assistant.examples.close": "Close",
  "assistant.examples.topic.words": "Words",
  "assistant.example.words.selected":
    "Make the title of the section I've selected shorter and friendlier.",
  "assistant.example.words.warmer":
    "Rewrite the first paragraph on the About page so it sounds warmer.",
  "assistant.example.words.spelling": "Fix any spelling mistakes on this page.",
  "assistant.examples.topic.images": "Images",
  "assistant.example.images.describe":
    "Describe each image on this page for people who can't see it.",
  "assistant.example.images.place": "Put the photo of our shop from Media in the Hero.",
  "assistant.examples.topic.sections": "Sections",
  "assistant.example.sections.hours": "Add a section with our opening hours to the Contact page.",
  "assistant.example.sections.questions":
    "Add a section of questions people often ask us, after the services.",
  "assistant.example.sections.move": "Move the contact form above the map.",
  "assistant.examples.topic.pages": "Pages",
  "assistant.example.pages.add":
    "Add a page called Prices, with a section for each of our services.",
  "assistant.example.pages.rename": "Rename the Team page to About Us.",
  "assistant.example.pages.order": "Move the Contact page to the end of the menu.",
  "assistant.examples.topic.theme": "Theme",
  "assistant.example.theme.warmer": "Make the site's colours warmer.",
  "assistant.example.theme.font": "Use a friendlier font for the headings.",
  "assistant.example.theme.corners": "Make the corners rounder.",
  "assistant.examples.topic.search": "Search engines",
  "assistant.example.search.descriptions": "Write a search description for every page.",
  "assistant.example.search.title": "Give the Home page a title that says what we do and where.",
  "assistant.example.search.hide": "Hide the Thank You page from search engines.",
  // A message sent while a reply is under way (5.19, OL-4): held, and sent when it finishes.
  "assistant.sendAfter": "Send After This Reply",
  "assistant.waiting.label": "Message waiting to send",
  "assistant.waiting.title": "Sends when this reply finishes",
  // A reply that finished holding changes to review (6.9e): the message waits for them.
  "assistant.waiting.afterChanges": "Sends once you apply or discard this reply's changes",
  "assistant.waiting.edit": "Edit",
  "assistant.waiting.remove": "Remove",
  // A question the assistant asks before acting on a vague request (5.16, OL-1).
  "assistant.question.title": "The assistant asks",
  "assistant.question.announce": "The assistant asks: {question}",
  "assistant.question.answers": "Answers",
  "assistant.question.recommended": "Recommended",
  "assistant.question.note": "Add a note (optional)",
  "assistant.question.orType": "Or type your own answer below.",
  "assistant.question.yourAnswer": "Your answer",
  "assistant.question.yourNote": "Your note",
  "assistant.question.unanswered": "Not answered.",
  "assistant.question.send": "Send as Your Answer",
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
  "assistant.model.priceyTitle": "Use a Costlier Model?",
  "assistant.model.priceyBody":
    "{model} costs about {cost} a reply, more than most. Your monthly limit still applies.",
  "assistant.model.usePricey": "Use This Model",
  "assistant.model.cancel": "Cancel",
  "assistant.model.advanced": "Advanced",
  "assistant.model.reviewBeforeApplying": "Review changes before they're made",
  "assistant.model.reviewBeforeApplyingHint":
    "The assistant shows what it would change, and makes nothing until you click Apply Changes.",
  "assistant.model.allowRetaining": "Allow models that may keep requests",
  "assistant.model.allowRetainingHint":
    "Off: only models whose providers don't keep or train on what you send.",
  "assistant.model.retainingTitle": "Allow Models That May Keep Requests?",
  "assistant.model.retainingBody":
    "With these models, the model's maker may keep what you send, your site's text included, or use it to train its models.",
  "assistant.model.allowRetainingConfirm": "Allow Them",
  "assistant.model.openRouterKey": "An OpenRouter key, instead of signing in",
  // The format toolbar's Rewrite (G25a, #873): the assistant's suggestion, reviewed before it's used.
  "assistant.rewrite.title": "Rewrite Text",
  "assistant.rewrite.description":
    "{how}: the assistant's suggestion. Your text changes only if you use it.",
  "assistant.rewrite.original": "Your text",
  "assistant.rewrite.suggestion": "Suggestion",
  "assistant.rewrite.writing": "Writing…",
  "assistant.rewrite.formatting": "Bold, italic, colours and links in this text aren't kept.",
  "assistant.rewrite.tooLong":
    "Select less text: the assistant rewrites up to {count} characters at a time.",
  "assistant.rewrite.use": "Use This",
  "assistant.rewrite.again": "Try Again",
  "assistant.rewrite.cancel": "Cancel",
  // Site Check's Write One… (G25b, #873): a page's description, or an image's alt text.
  "assistant.write.description.title": "Write a Description",
  "assistant.write.description.about":
    "The assistant's description of {subject}, for search results and shares. Change it as you like: nothing changes until you use it.",
  "assistant.write.description.label": "Description",
  "assistant.write.alt.title": "Write Alt Text",
  "assistant.write.alt.about":
    "The assistant's alt text for {subject}, from its file's name and the text near it. It can't see the picture, so check it says what the picture shows: nothing changes until you use it.",
  "assistant.write.alt.label": "Alt text",
  "assistant.write.history.description": "Wrote the description of {page}",
  // The quick start's business step (QS-7, #873): the home and About pages' words.
  "assistant.business.title": "Words for Your Pages",
  "assistant.business.about":
    "The assistant wrote your home and About pages' words from what you said about your business. Check each one and change what you like: nothing changes until you use them.",
  "assistant.business.writing": "Writing your pages' words…",
  "assistant.business.use": "Use These",
  // A drafted text that holds an example for a fact the person didn't give (#1228, WN-3).
  "assistant.business.example": "Example",
  // A change of a reply whose element holds an example (#1228, WN-3), on the review card.
  "assistant.review.example": "Example",
  "assistant.review.examples.one":
    "1 change holds an example for a detail you didn't give: check it.",
  "assistant.review.examples.other":
    "{count} changes hold examples for details you didn't give: check them.",
  "assistant.business.examples.one":
    "1 text holds an example for a detail you didn't give: check it before you publish.",
  "assistant.business.examples.other":
    "{count} texts hold examples for details you didn't give: check them before you publish.",
  "assistant.business.keep": "Keep the Template's Words",
  "assistant.business.history": "Wrote the home and About pages' words",
} as const;
