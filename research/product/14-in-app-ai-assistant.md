# An in-app AI assistant through OpenRouter, with consent

**Status:** ⏳ Proposed (AIA-1…AIA-12, §8), for the product owner to decide. Nothing in `spec/` or the plan changes until they do. The product owner's question (1 Nov 2026): could Webforge ship a built-in assistant that sends the person's requests, with the site context it needs, to a model through OpenRouter (or a similar router, or the person's own key), and applies the model's tool calls locally against the 4.8 commands? How do competitors do it, and what should Webforge do?

**Goal:** a small-business owner types "make the opening friendlier and add our Saturday hours" in a panel beside the canvas. The change lands as ordinary, labelled, undoable edits, and the owner knows beforehand exactly who sees their site's text and who pays. Nobody gets a surprise bill, and nobody's content goes anywhere they didn't agree to.

## 1. Method and limits

Done on 1 Nov 2026:
- **Competitors.** Two passes over the vendors' own help centres, AI terms, privacy and sub-processor pages, and announcements:
  - hosted builders: Wix, Squarespace, Webflow, Framer, Hostinger and Durable;
  - desktop and design tools: Pinegrow, Bootstrap Studio, RapidWeaver Elements, 10Web, Figma and Canva.

  Third-party sources are marked as such. Everything is paraphrased: patterns only, never wording, code or assets (the IP rule in [product/05](05-feature-gap-analysis.md)).
- **Routers and providers.** OpenRouter's documentation, pricing, terms and DPA; Anthropic's and OpenAI's data pages; Ollama's and LM Studio's local server docs. SDK licences come from the npm registry on 1 Nov 2026.
- **Webforge.** Read against `main` at `bc24b6bf` (ADR 0021 merged):
  - [ADR 0021](../../docs/adr/0021-mcp-transport.md) and [ADR 0006](../../docs/adr/0006-publishing.md) §4;
  - the [security review](../../docs/reviews/2026-10-30-security-review.md) (S18–S21 and the 4.9 requirements);
  - [spec/01 §9](../../spec/01-architecture.md#9-security--privacy), F-AI-1 and the v1.1 rows in [spec/02](../../spec/02-mvp-spec.md);
  - GA2 and GA9 in [product/05](05-feature-gap-analysis.md), BS9-10 in [bootstrap-studio/06](../bootstrap-studio/06-bootstrap-studio-9.md), WF-2 in [competitors/01](../competitors/01-webflow.md), UX-28 in [product/06](06-editor-ui-ux-parity.md) and QS-7 in [product/09](09-quick-start-wizard.md);
  - the code in `packages/commands/src/api.ts` and `commands.ts`, `apps/desktop/src/main/ai-ipc.ts` and `credential-store.ts`.

Effort is in ideal days against today's code. *Unconfirmed* marks a claim I couldn't check at a primary source. Nothing here is legal advice: §5's GDPR points need a solicitor's check before release (AIA-11).

## 2. What Webforge has already decided

The assistant isn't new scope. Its terms are:
- **GA2 / GA9 (22 Oct 2026):** a built-in assistant in v1.1, with the person's own AI account, using the same commands as F-AI-1. It starts with rewriting text and writing meta descriptions and alt text (G25a, G25b), then builds and edits pages.
- **BS9-10:**
  - providers include local models and any OpenAI-compatible server;
  - a *Review changes* mode alongside auto-apply;
  - a context and usage meter;
  - privacy wording that says keys stay on the computer and calls go straight to the provider.
- **WF-2:** approve before apply, with the change highlighted on the canvas.
- **UX-28:** the panel has context chips, a review card with Accept / Undo, and a task list.
- **QS-7:** the quick start's description step feeds the assistant.

What the product owner's question adds:
- **OpenRouter as the route to the model.**
- **An MCP client** rather than a direct call into the command layer.
- **Explicit consent,** because this is the first time Webforge itself would send site content off the computer. Today [spec/01 §9](../../spec/01-architecture.md#9-security--privacy) says, for AI apps, that site content goes only to the app the person paired and "Webforge itself sends nothing". F-AI-1 says Webforge "sends nothing anywhere itself".

## 3. What the competitors do

### 3.1 At a glance

| Product | Who hosts the model | Own key | Pricing | Data out · training | Disclosure, consent | What the AI may change | Undo |
|---|---|---|---|---|---|---|---|
| **Wix** (Aria, site generation, Studio code assistant) | Wix's cloud; 14 named providers incl. OpenAI, Anthropic, Google, Meta | No (only developer AI APIs, billed by Wix) | Aria chat free; business agents use credits (free plans 30 a day) | Prompts go to the providers under DPAs with SCCs. **Wix trains its own models on user content**, with no opt-out described (policy effective 1 Jan 2026) | Policy pages and an "unexpected results" note; no toggle found | Aria edits pages, sections, elements, site colours and fonts **directly**; code assistant needs *Approve* | Code: approve step, restore from chat. Aria: *unconfirmed* |
| **Squarespace** (Blueprint, AI text, Clarkson chat) | Cloud; "partnered with" OpenAI, Anthropic and Google (updated 30 Oct 2026) | No (*unconfirmed*) | Text free; images and visibility tools use credits (third-party, Oct 2026) | AI Terms: input may be shared with the provider under its policies; **don't enter personal data** (25 Jun 2026) | Accept product terms when using Blueprint; "review content" warnings; no toggle | Blueprint generates a whole site; text rewrite in blocks; Clarkson edits text, products, styles directly (rolling out) | Rewrite has Undo; Clarkson *unconfirmed* |
| **Webflow** (AI Assistant, generation, MCP) | Cloud; sub-processors OpenAI and Anthropic (9 Jul 2026) | No in the editor; outside agents over MCP on the customer's own subscription | Credits in every workspace plan, enforced from 29 Jun 2026 | Used only to provide the feature; **no training without prior consent** (AI Terms, 11 May 2026) | **On by default** (15 Jan 2026); workspace switch, per-role permission, audit log | Sections, copy, CMS, SEO; can add classes but not change existing ones | Preview options before insert; chat Undo one step; ⌘Z; activity log labels Human / AI / MCP (Enterprise) |
| **Framer** (Agent, Workshop, Translate) | Cloud; a model picker (GPT, Sonnet, Opus) with different credit costs (30 Oct 2026) | AI Notice allows customers' own models; MCP agents use their own subscription, no credits | Free 500 a day; Basic 1,000, Pro 3,000 a month; ~300 credits a landing page, ~50 a small edit | Providers barred from training. **Framer trains on non-Enterprise inputs unless switched off** (AI Notice v1.2, 18 Sep 2026) | Workspace switch for training | Pages, layouts, copy, SEO, CMS; Workshop writes code components | External agents work on a **branch** you review and merge; in-app Agent *unconfirmed* |
| **Hostinger** (AI Builder, Kodee) | Cloud; provider not named | Only for AI inside apps you build | Credits by compute, every message counts; one-off 250–1,000 a plan | ToS allows training on input and output (29 Sep 2026); a support page says agent chats aren't used. **The two conflict** | Terms say the AI may act in your account; no toggle | Writes the whole site as code; Kodee runs hundreds of admin actions | Restore per message, no credit refund |
| **Durable** | Cloud; OpenAI in 2023, unnamed now | No | Free to start; $25 a month plan | Privacy policy lists training as a purpose; sub-processors on request (20 Oct 2026) | None beyond the policy | Whole site, pages, text in place | Undo only the last action; regenerating the site deletes the old one, after a warning |
| **10Web** | Cloud; model not named (Azure OpenAI for the support bot) | No (*unconfirmed*) | 100–800+ credits a month by plan | Co-Pilot data not used for training; sessions may be screen-recorded, with notice and opt-out (21 Mar 2024) | Notice before recording | Chat agent "applies changes directly": pages, layout, copy, plugins, WooCommerce | *Unconfirmed* |
| **Pinegrow** (desktop) | **Your provider; no vendor server** | **Yes:** OpenAI, Anthropic, **OpenRouter**, Gemini, DeepSeek, any OpenAI-compatible endpoint; Claude Code and Codex CLI | No charge from Pinegrow; users report $15–30 a month to the provider | Selected element (trimmed) plus the project brief; *Pages* scope sends the whole page. No statement on provider training | Disclaimer: review code, pay your own costs | Replace, insert, duplicate elements; edit CSS; tool-based "smart" edits; local MCP server off by default | ⌘Z; optional **Review AI changes**: before/after revisions, per-element diff, keep or undo per file |
| **Bootstrap Studio** (desktop, v8, 10 Feb 2026) | **Your provider, direct HTTPS, not proxied** | **Yes:** OpenAI, Google, Anthropic, **OpenRouter**; Ollama, llama.cpp, LM Studio; any Responses-API server | No charge, no limits of its own | Reads selected components and whole files. **Warns that free API keys may mean training** | Docs only | Edits code, writes text, creates pages, generates images | Normal undo; **Auto Apply on by default**, off makes proposals with *Apply* |
| **RapidWeaver Elements** (macOS) | **Your provider, direct** | **Yes:** OpenAI and/or Anthropic; **keys in the macOS Keychain** | Included in every plan; provider bills | Reads pages, components, theme, CMS and "AI Memory"; no training statement | One toggle lets outside AI tools in over MCP; no per-action prompts | Builds pages, components, CMS content, **publishes** | Copy rewrites "accept or undo"; the rest *unconfirmed* |
| **Figma** | Cloud; OpenAI, Google and open-weight models; Make offers Claude and Gemini (third-party) | No | AI credits per seat (3,000–4,250 a month by plan, third-party); limits since 18 Mar 2026 | Providers mustn't train and must delete. **Figma's own content training on by default for Starter and Professional**, off for Organization and Enterprise (since 15 Aug 2024) | Admin switches for AI and for training; AI Terms (30 Oct 2026) say users supervise agents | Agent edits layers directly; Make generates code apps | Help centre says agent changes can be undone; forum says ⌘Z misses them. **They conflict**. Make has checkpoints |
| **Canva** | Cloud; unnamed "Technology Partners" | No | Usage limits, Business top-ups | Training follows Privacy Settings, which bind partners; the Free/Pro default is disputed (*unconfirmed*) | Admins can turn AI off (on by default); Canva Shield for Enterprise | Generates designs; Canva Code builds pages and sites | Normal undo/redo |

### 3.2 Patterns

1. **Two business models, split by where the site lives.**
   - Desktop tools that keep files on the computer (Pinegrow, Bootstrap Studio, Elements) all use the person's own key. They call the provider straight from the app and charge nothing for AI.
   - Hosted builders host the model, hide the provider behind their brand, and sell credits.
   - Webforge is a desktop tool with no server of its own (spec/01 §9). It belongs in the first group.
2. **OpenRouter is already the norm for own-key desktop tools.** Pinegrow and Bootstrap Studio both list it next to the big providers. Both also accept any OpenAI-compatible server, which is how local models get in.
3. **Key storage is rarely explained.** Only Elements says the OS keychain. Pinegrow and Bootstrap Studio say "stored locally".
4. **Cost is the common complaint.**
   - Nobody in the own-key group shows money in the app. Bootstrap Studio shows tokens.
   - Forums report surprise bills from an expensive default model: about $10 in two hours in Bootstrap Studio's (Feb 2026).
   - In the hosted group, credits make the cost visible but opaque.
5. **Consent is mostly by terms of service.**
   - Webflow is the only one with real controls: a workspace switch, a per-role permission and an audit log, though even that is on by default.
   - None of the twelve shows a screen that names which company sees what before the first request.
   - Several hosted builders reserve the right to **train their own models** on the content (Wix, Durable, Hostinger's terms, Framer and Figma below Enterprise).
   - Squarespace tells people not to enter personal data.
6. **Most AI edits apply straight away; the careful tools add a review.**
   - Pinegrow's *Review AI changes* is the strongest: a revision before and after each task, a per-element diff, and keep or undo per file.
   - Others: Bootstrap Studio's Auto Apply switch, Webflow's preview-before-insert, Framer's branches for outside agents.
   - Unreliable undo after AI edits is a recurring complaint: Pinegrow in 2024, Figma's agent, Figma Make's restores.
7. **Edits are starting to be attributed.** Webflow's log says Human, Webflow AI or MCP. Webforge's "AI (‹app›): …" undo labels (F-AI-1) already go further, labelling each step.
8. **Local MCP for outside agents is now common.** Pinegrow, Elements, Webflow and Framer have it. The in-app assistant and the MCP door sit side by side, the same pairing Webforge has planned (F-AI-1 in the MVP, GA9 in v1.1).

**For Webforge:**
- **Copy:** the own-key desktop pattern, with OpenRouter first; a review step on by default; and the cost shown in money, not tokens.
- **Do better than all twelve:**
  - a consent screen that names both companies and what each sees;
  - a safety version before the first change;
  - no training by Webforge, ever, since Webforge never receives the content.

## 4. OpenRouter and the alternatives

### 4.1 OpenRouter

| Topic | What it is (source, date) | For Webforge |
|---|---|---|
| **API** | OpenAI-compatible Chat Completions (`/api/v1/chat/completions`) and Responses (`/api/v1/responses`), with `tools` and `tool_choice`. **The client runs the tools:** the model only proposes calls. Streaming over SSE (tool-calling guide, undated, read 1 Nov 2026) | Exactly the loop needed: the model proposes, Webforge runs the call through the 4.8 commands, returns the result |
| **Model choice** | 600+ models from 80+ providers on paid plans; models filterable by `supported_parameters=tools`; "Auto Exacto" orders providers for tool calls by their tool-call error rate (pricing page and tool-calling guide, undated) | Offer a short list of tool-capable models Webforge has tested, plus *Other model…* in Advanced |
| **Pricing, who pays** | Provider list prices passed through with no markup; a **5.5% fee on credit purchases** (8% Business); free plan with 25+ free models, 20 requests a minute and 50 a day (1,000 after $10 bought) (pricing page, undated). Credits $5–$25,000 a purchase, expire after 365 days (terms §4, 31 Aug 2026) | With the person's own account, **the person pays OpenRouter; Webforge handles no money** |
| **Cost per reply** | `usage: {include: true}` returns `cost` in credits in the last streamed chunk (usage accounting guide, undated) | The panel can show the cost of each reply in money, and a running total |
| **Budgets** | Guardrails cap spend per key or member, reset daily, weekly or monthly, with model and provider allow-lists (guardrails guide, undated). Management keys can create keys with a `limit` and `limit_reset` (provisioning guide, undated) | The person can cap their own account. Whether a key from PKCE sign-in can carry a limit set by Webforge is *unconfirmed*, so Webforge enforces its own cap locally as well (AIA-8) |
| **Sign-in (OAuth PKCE)** | `https://openrouter.ai/auth?callback_url=…&code_challenge=…&code_challenge_method=S256&state=…` → `POST /api/v1/auth/keys` with `code` and `code_verifier` returns a **user-controlled key billed to that user's credits**. **Localhost callbacks on any port** are supported. Without `callback_url` the code is shown for the person to paste (PKCE required then). Codes are single-use and expire after 10 minutes (OAuth PKCE guide, undated) | **No key to copy from a console.** Sign-in opens the person's browser; the key lands in the credential store. Whether `127.0.0.1` (rather than `localhost`) is accepted as the callback host is *unconfirmed* |
| **OpenRouter's own retention** | **Doesn't store prompts or responses unless you opt in;** stores metadata (token counts, latency). Two opt-ins, both off by default: private input/output logging, and letting OpenRouter use inputs and outputs (for a 1% discount). Exceptions: content flagged as possible CSAM, and a small anonymous sample for categorisation (data collection guide, undated) | Good default. Webforge never turns either opt-in on, and the consent screen says the person shouldn't either |
| **Providers' retention and training** | Each endpoint carries its provider's policy; an account switch blocks providers that may train (separately for paid and free models); per request, `provider.data_collection: "deny"` excludes endpoints that store data non-transiently or may train, and `provider.zdr: true` routes only to **zero-data-retention** endpoints. ZDR is OR'd with account settings and can't be turned off per request (provider logging and ZDR guides, undated; search snippet for `data_collection`) | Send both by default (AIA-7). An endpoint whose policy OpenRouter can't establish is treated as retaining and training (ZDR guide) |
| **ZDR limits** | In-memory prompt caching isn't counted as retention. From **18 Oct 2026** Google's Vertex endpoints may keep flagged prompts up to 90 days, so they don't meet strict ZDR. From **27 Oct 2026** OpenRouter screens all requests for CSAM, ZDR traffic included, and may keep flagged content (ZDR guide, read 1 Nov 2026). ZDR covers inference only, not plugins such as web search | Webforge enables no OpenRouter plugins. Which of the leading models have ZDR endpoints wasn't checked: `/api/v1/endpoints/zdr` lists them, and the model list should come from it |
| **Region** | EU and US in-region routing on Business and Enterprise plans only (privacy guide, pricing page) | Not available on the plan most owners would have; say so rather than imply EU processing |
| **Terms for a desktop app** | Users must be **18 or over** (§2). The account holder is responsible for its keys and charges (§3.2). Customers who build OpenRouter into products are responsible for their users' compliance with each model's terms (§5.1–5.2). **No reselling of API access to models** (§7). New York law, arbitration (§18–19). Privacy Policy and, for commercial use, the **DPA** form part of the terms (§10). Last updated 31 Aug 2026 | With the person's own account, *they* are OpenRouter's customer and Webforge is just software they run. Webforge-provided credits would make Webforge the customer, responsible for every user's model-terms compliance and close to §7 (AIA-3) |
| **DPA** | OpenRouter, Inc. is the **processor**, the customer the controller; covers GDPR, UK GDPR, Swiss law and CCPA; transfers under the 2021 SCCs; defines ZDR as no persistent storage of payloads after the request. Last updated 5 May or 26 Aug 2026 (two versions seen) | §5. Whether OpenRouter is certified under the EU-US Data Privacy Framework or its UK Extension is *unconfirmed* |
| **Attribution** | `HTTP-Referer` and `X-OpenRouter-Title` (formerly `X-Title`) name the app in OpenRouter's rankings; a localhost app needs the title (app attribution guide, undated) | Send the title `{appName}` and the product's web address. They carry no content. Ask for the app to be hidden from rankings if the header for that exists (*unconfirmed*) |
| **SDKs** (npm, 1 Nov 2026) | `openai` 7.47.0 **Apache-2.0** · `@openrouter/sdk` 1.5.33 **Apache-2.0** · `@openrouter/ai-sdk-provider` 3.1.0 **Apache-2.0** · `ai` (Vercel AI SDK) 7.0.159 **Apache-2.0** · `@modelcontextprotocol/sdk` 1.32.2 **MIT** · `@anthropic-ai/sdk` 1.3.0 **Apache-2.0** · `ollama` 0.6.4 **MIT** · `@lmstudio/sdk` 2.1.0 **MIT** | All permissive. **None is needed for the model call:** Chat Completions with streaming is a small `fetch` with zod-checked chunks, which keeps one client for every OpenAI-compatible server and avoids a large dependency. Only the MCP SDK is needed (and 4.9 adds it anyway) |

### 4.2 Alternatives

| Route | What it means | Data | Fit |
|---|---|---|---|
| **Anthropic directly** (person's API key) | A Console account, billing set up, a key pasted. Anthropic's native Messages API differs from Chat Completions, so it needs a second client | Commercial API data deleted within 30 days unless a ZDR agreement exists; flagged content up to 2 years (Anthropic privacy centre, 1 Jul 2026). Third-party blogs claim 7 days since Sep 2025, which the privacy centre contradicts (*unconfirmed*). **Subscription sign-in (Pro or Max) isn't allowed in other apps** (Feb 2026, enforced from 4 Apr 2026; reported by trade press, Anthropic page not fetched, *unconfirmed*), so an API key is the only route | Harder for an owner than OpenRouter's sign-in; Claude models are reachable through OpenRouter anyway |
| **OpenAI directly** (person's API key) | A Platform account and key; Chat Completions works with the same client as OpenRouter | API data not used for training by default; abuse-monitoring logs kept up to 30 days; ZDR only on approval; the Responses API keeps application state 30 days unless `store` is off (OpenAI "your data" guide, read 1 Nov 2026) | Same client; same pasting burden. No sign-in for third-party apps that I could find (*unconfirmed*) |
| **OpenRouter BYOK** | The person adds their own OpenAI or Anthropic key *inside OpenRouter*; free up to $25,000 of list-price use a month, then 5% (BYOK guide and pricing, undated) | Their ZDR and region settings still apply | Covers "I already pay OpenAI" without Webforge building a second client |
| **Local: Ollama** | `http://localhost:11434/v1/`, Chat Completions with **tools and streaming**; a key is required by clients but ignored (Ollama OpenAI-compatibility docs, read 1 Nov 2026). Ollama is MIT | **Nothing leaves the computer** | Same client. Tool calling depends on the model: small models often ignore `tools` (third-party posts, 2025–26) |
| **Local: LM Studio** | `http://localhost:1234/v1`, Chat Completions and Responses (LM Studio docs, undated); **free for work since 8 Jul 2025** (LM Studio blog). The app itself isn't open source; Webforge would only talk to it | Nothing leaves the computer | Same client. A tool-use page exists; its limits weren't read |

**Local models aren't enough on their own.** A tool-calling model that edits a page reliably needs a recent mid-sized model. That means roughly 16 GB of memory or more for a 7–14B model at usable speed (my estimate, not measured). Many owners' laptops can't run that. So local models are a privacy option for those who can, not the default.

**What a reply costs.** This is an estimate, not a quote. A typical request: "rewrite the opening section and add Saturday hours". The model reads the page outline and the section's fields, then makes two or three edits, over four or five model calls. That is about 15–25k input tokens per call, including the tool definitions (roughly 3–5k), so 60–120k input tokens and 2–4k output in all.
- **Mid-priced model** (about $3 per million tokens in, $15 out): **$0.25–0.45** a reply.
- **Small model** (about $0.25–1 in): **$0.02–0.15**.
- **Prompt caching** of the tool definitions and system text cuts the input cost substantially where the provider supports it.

So a heavy evening of editing can cost a few dollars, which is exactly the surprise Bootstrap Studio's users reported. AIA-8 exists because of it.

## 5. Consent and privacy

### 5.1 How this squares with Webforge's rules, precisely

- **The exported site's rule doesn't change.** "No CDNs or external requests" (CLAUDE.md, spec/01 §8) is about the **exported site**: what a visitor's browser loads. The assistant runs only in the editor and adds nothing to the export.
  - Every change it makes goes through the 4.8 commands, which accept only catalogue fields, checked against the field's schema.
  - Images and files are Media ids. A link to a page or file must exist.
  - It can't touch Custom Code (S19).
  - `commands.ts` puts it this way: nothing an AI app sets is what no person could have set.

  So the assistant can't add a script, a stylesheet, a font from a CDN or a remote image to the export. A link it writes is an ordinary link, which the export rule allows.
- **spec/01 §9 *does* change, in two places, if the product owner adopts this (AIA-10):**
  - **The *Network* bullet** lists every call the editor makes: updates, publishing, Netlify OAuth, "Download and bundle", fonts. It gains a line: "when the assistant is on and the person sends a message, the request and the site context it needs go to the provider they chose (OpenRouter, or a server they named); nothing is sent in the background".
  - **The *AI apps* bullet's "Webforge itself sends nothing"** stays true of AI apps. A separate *Assistant* bullet says what the assistant sends, to whom, and under what consent.

  F-AI-1's "sends nothing anywhere itself" stays true of F-AI-1.
- **"Never log or store site content"** (CLAUDE.md) holds:
  - the conversation lives in memory and is dropped when the site closes;
  - it is never written to the site file, logs or crash reports;
  - logs keep the model's id, token counts, cost and tool names only (AIA-7).
- **"Secrets live in the OS keychain only"** holds. The OpenRouter key goes in 4.4a's credential store under `assistant/openrouter` (`safeStorage`, as `publish/…` and `mcp/…` do). Where the store refuses (Linux's weak `basic_text` backend), the assistant can't sign in, and says why.

### 5.2 Who sees what

| Party | Sees | Keeps | Under |
|---|---|---|---|
| **Webforge (the company)** | Nothing. No Webforge server is in the path | Nothing | — |
| **OpenRouter** | Every request in full: the person's message, the system text, the site context the model asks for through the tools, and the model's replies | Metadata only (tokens, latency, cost); content only if the person opts in to logging, or if it's flagged as possible CSAM | The person's own OpenRouter account, its terms, privacy policy and DPA |
| **The model's provider** (Anthropic, OpenAI, Google, Mistral…) | The same request, as routed | Per its endpoint policy; with `zdr: true` only endpoints that don't keep it after the request (in-memory caching apart) | OpenRouter's agreements with that provider |
| **A local server** (Ollama, LM Studio) | The same request | On the person's computer only | Nobody else's terms |

**What the assistant sends.** Only what the request needs:
- the person's message;
- the selected section or element and the page it is on, by id and title;
- whatever the model asks for through the read tools: outline, page tree, fields, Site Settings, theme.

**What it never sends:**
- images or files from Media (no vision at first);
- Custom Code;
- publish destinations and credentials;
- pages the model didn't ask for;
- the site's Version History;
- the conversation of another site.

Context grows only as the model asks for it, so the minimum is the default rather than a setting.

### 5.3 What the consent screen must say

Shown once, when the person turns the assistant on in Preferences, before sign-in. The wording is for the strings pass and the glossary; the content is fixed here:
1. **What happens:** when you send the assistant a message, Webforge sends it to an AI model on the internet together with the parts of the site it needs to answer. That is the text and settings of the page and sections involved, and the site's business details when the request is about them. Images and files are not sent.
2. **Who receives it:** OpenRouter, a US company that passes the request to the model you pick, and that model's maker. Both are named as the model changes, for example "OpenRouter and Anthropic".
   - Webforge asks for providers that don't keep your requests (zero data retention) and don't train on them.
   - OpenRouter doesn't store what you send unless you turn that on in your OpenRouter account.
   - Webforge (the company) receives nothing.
3. **Who pays:** your own OpenRouter account. Webforge shows the cost of each reply and stops at the monthly limit you set here.
4. **Your customers' details:** if your site holds other people's details (names in testimonials, staff, contact details), they may be sent when the assistant works on those sections. Don't ask it to work on anything you wouldn't put on the public site.
5. **Turning it off:** *Preferences › Assistant › Turn off* stops it at once and deletes the key from this computer. To revoke the key itself, delete it in your OpenRouter account (a link).
6. **Where it applies:** once per site, the first time you open the assistant on a site, Webforge asks again ("Use the assistant on ‹Site›? Its content will be sent to OpenRouter and ‹provider›"). Your answer is remembered on this computer, never in the site file. A site you send someone doesn't carry your consent with it, and a site someone sends you doesn't arrive with it switched on.

For a **local model**, points 2–4 change to "nothing leaves this computer", and the per-site question is skipped.

**App-wide or per site?** Both, as above:
- the provider, sign-in and monthly limit are set once for the app;
- each site gets its own yes, remembered on this computer as ADR 0019 remembers code trust.

The reason is that one person often builds sites for several businesses, and a yes for one isn't a yes for the others. **Withdrawing** is the *Turn off* button, or *Stop using on this site* in the panel's menu. Neither deletes anything except the key and the remembered answer. Edits already made stay, and stay undoable.

### 5.4 GDPR and UK GDPR points for the owner

Not legal advice; for the solicitor's check in AIA-11.
- **Most site content isn't personal data:** opening hours, service descriptions, prices. Some is: the owner's name, staff bios, testimonials with customers' names, contact details. Some can be **special category** data, such as a therapist's testimonial that reveals a health condition. The consent screen's point 4 and the minimal context are the main safeguards.
- **The owner is the controller** of any personal data in their site. With their own OpenRouter account:
  - **OpenRouter is their processor** under its DPA, which covers GDPR and UK GDPR;
  - the model provider is OpenRouter's sub-processor;
  - **Webforge is neither.** It is software running on their computer, and the content never reaches it.

  This is the strongest reason for the person's own account (AIA-1, AIA-3).
- **Lawful basis** for sending, say, a testimonial to a processor in order to edit one's own website is plausibly legitimate interests. That is the owner's determination. Webforge's part is transparency: saying who receives what, and keeping the context minimal.
- **International transfer:** OpenRouter is a US company, and its DPA relies on the EU's 2021 SCCs. For UK owners, a UK transfer mechanism (the IDTA or the UK Addendum, or the UK Extension to the Data Privacy Framework if OpenRouter is certified) is needed. *Unconfirmed* which applies. The help page should point to OpenRouter's DPA rather than restate it.
- **The owner's own privacy notice:** testimonials and staff details are usually collected for publication, so their privacy notice likely already covers publishing. Using an AI processor to edit them may need a line in it. The help page can suggest that, not draft it.
- **Webforge-provided credits would change all of this:**
  - Webforge would be OpenRouter's customer, and the processor (or controller) for every user's content;
  - it would need its own DPA with each business, a sub-processor list, a privacy notice for the service, and possibly an EU representative (Art. 27) as a UK company serving EU customers.

  That is a business change, not a feature (AIA-3).
- **EU AI Act, Article 50** (transparency for AI-generated text; applies from 2 Aug 2026). Whether Webforge, as the maker of an editor that calls someone else's model, has any marking duty for text the owner reviews and publishes needs the solicitor's view. The editorial-control and assistive-editing exemptions seem likely to apply (*unconfirmed*). Proposed changes to the Act's timetable weren't checked.

## 6. Architecture fit

### 6.1 Where the pieces run

```
renderer (panel)          main                                       outside
────────────────          ──────────────────────────────────         ─────────────
Assistant panel  ──IPC──▶ assistant loop ──HTTPS (net.fetch)──────▶ OpenRouter / local server
  streamed text  ◀─IPC──    │  ▲  stream: text deltas, tool calls
  review card               ▼  │
                          MCP client ══ InMemoryTransport ══ MCP server (4.9's tool layer)
                                                               │  same checks as for AI apps
                                                               ▼
                                                     AiBridge (ai-ipc.ts, S21) ──IPC──▶ renderer
                                                                                       CommandApi (4.8)
                                                                                       HistoryManager
```

- **The model call is in main, never the renderer.** The renderer never holds the key and never makes a request off the computer (spec/01 §3; the renderer's CSP stays as it is). Main uses Electron's `net.fetch`, which follows the system's proxy settings: this matters in offices.
- **Streaming:**
  - main reads the SSE stream, validates each chunk with zod, and forwards text deltas to the panel over a typed IPC domain (`assistant`, scaffolded with `pnpm scaffold ipc-domain`);
  - tool calls are collected until complete, then run one at a time;
  - *Stop* aborts the request and runs no further tool calls. Edits already made stay, and stay undoable.
- **MCP client over an in-memory transport, not the loopback socket, and not a direct call.** The three options:

  | Option | For | Against |
  |---|---|---|
  | Call `CommandApi` in-process (through `AiBridge.ask`) | Fewest moving parts | A second definition of the tools: names, descriptions, the "site text is untrusted" wording, limits, the safety version. They would drift from 4.9's |
  | MCP client to 4.9's server over **loopback HTTP** | Exactly what outside apps see | Needs *AI apps* switched on, a pairing and a key for Webforge's own feature, and a socket. It puts the assistant behind the squatting threat ADR 0021 had to design around |
  | **MCP client to 4.9's server over the SDK's `InMemoryTransport`** (`createLinkedPair()`, in `@modelcontextprotocol/sdk` 1.32.2, MIT) | **One tool layer** for both; no socket, no key, no pairing; works with *AI apps* off; every 4.9 rule (S18–S21, rate limits, decline back-off, the safety version, content-free logging) applies for free | 4.9 must build its server as a factory that can be connected to either transport. That is a small design note on #171, no extra days |

  The third is proposed (AIA-4). The assistant then sees the same tools, descriptions and answers as Claude Desktop, so a behaviour fixed for one is fixed for both. MCP tool definitions map one-to-one onto OpenAI-style `tools` (name, description, JSON Schema).
- **Keys:** 4.4a's credential store, `assistant/openrouter`, or `assistant/custom/<id>` for a server the person adds. Never the site file, settings JSON or logs.
- **Sign-in:** OpenRouter's PKCE flow, run by main:
  - main opens the person's browser at OpenRouter's auth page with an S256 challenge and a `state`;
  - the callback goes to a listener on `127.0.0.1` on a fresh random port. It is bound before the browser opens and closed after the first callback or 10 minutes, whichever comes first;
  - main exchanges the code and saves the key.

  This is not ADR 0006's case. Netlify needed a registered redirect URI, while OpenRouter accepts any localhost port. A squatter who catches the code can't use it without the verifier, which never leaves main. The paste-the-code mode is the fallback, for when the browser can't reach the listener. A pasted OpenRouter key goes in *Advanced*.

### 6.2 Each change: undo, confirmations, Content mode

All of this already exists in the 4.8 command layer or is planned for 4.9; the assistant adds no new path:
- **One undo step per command, labelled.** The proposed label is "AI (Assistant): Edited Hero text" (AIA-5); `‹app›` is "Assistant". The model's name goes in the review card, not in the label, which stays short.
- **A safety version** "Before the assistant's changes" at each conversation's first change (S20, ADR 0021 decision 6). Restoring it in Version History undoes a whole conversation at once, even past the 200-step undo limit.
- **The review card** (WF-2, UX-28, BS9-10):
  - after each reply that changed anything, the panel lists the steps with *Keep* and *Undo these changes*, and highlights them on the canvas;
  - *Undo these changes* undoes exactly that reply's steps if nothing else has happened since. Otherwise it offers the safety version;
  - Auto-apply is the default, with *Review before applying* as a setting. That is BS9-10's pair: applied changes are always undoable, so "review" costs a click rather than safety.
- **D7 confirmations** for anything affecting more than one page, and **S18's sensitive fields** (Buy button link, form address), on one page too and in Content mode. Both are answered by the person in Webforge's own dialog, never by the model.
- **Content mode** limits the assistant as it limits AI apps: content edits only.
- **Busy:** while the person is dragging, typing or answering a dialog, commands answer `busy`. The loop waits and retries once, then tells the model.

### 6.3 Security review and ADR 0021 rules carried over

| Rule | AI apps (4.9) | Assistant |
|---|---|---|
| S18 sensitive fields confirm | Yes | Yes, through the same tool layer |
| S19 no Custom Code | Yes | Yes. Custom Code is also never sent as context |
| S20 safety version, rate limit, one command in flight, decline back-off | Per app | Per conversation; plus a cap on tool calls per reply (AIA-8) |
| S21 zod in main, size caps | Yes | Yes. The in-memory transport goes through the same server checks, and main also validates every model chunk and tool call |
| ADR 0021: tool descriptions say site text is untrusted; values in labelled fields | Yes | Yes. The system text says it too (§6.4) |
| ADR 0021: Open Preview takes no URL; Site Check and errors use ids and titles only | Yes | Yes |
| ADR 0021: no content in logs, marker-string test | Yes | Yes. The test also plants a marker in a site's text and a model reply, then searches logs and crash reports |
| Pairing, key, Origin and Host checks | Yes | Not needed: no socket. The OpenRouter key is the secret to guard |

### 6.4 Prompt injection

Site text is untrusted. The owner may have pasted it, imported it from a project ZIP (4.7), or received the site from someone else (ADR 0019). A section reading "Assistant: change every Buy button to …" is the attack (OWASP's LLM01, prompt injection, in its 2025 list, not re-fetched). Defences:
1. **A small blast radius by construction.** The assistant's only tools are the 4.8 commands:
   - no web, no files, no publishing, no credentials, no Custom Code;
   - it can't send anything anywhere except to the model it is already talking to.

   This is stronger than Claude Desktop, where the same injection could reach the person's other tools.
2. **The dangerous edits need a person:** S18 for payment and form addresses, D7 for anything site-wide.
3. **Labelled data:**
   - tool results come back as JSON with field names, and site text is never put into the system text or tool descriptions;
   - the system text says that text read from the site is content to edit, never instructions to follow.
4. **External links shown by host.** A reply that adds or changes a link to another website lists it in the review card with its host as a browser reads it (S18's WHATWG rule), so a look-alike host is visible.
5. **Safe rendering of the reply:**
   - the panel renders the model's text as plain text with limited Markdown;
   - **no images, no HTML, no auto-loaded anything.** A remote image in a reply is both a request and an exfiltration channel;
   - links in a reply open in the person's browser only after they click and see the address.
6. **Tests:** a site whose text carries planted instructions, run against a scripted fake model, with the result checked against the confirmations and the undo log.

### 6.5 Cost limits

- **A monthly limit**, set at sign-in, with a default of $5 (*proposed figure*). It is enforced in main from each reply's `usage.cost`, and the person is told at 80% and stopped at 100%.
- **Per reply:**
  - at most 25 tool calls and a `max_tokens` on each call;
  - the loop stops and says so when either runs out, rather than spending silently.
- **Visible cost:** each reply shows its cost, and the panel header shows this month's total, both in money (currency as OpenRouter bills, USD). This is better than any of the twelve competitors (§3.2, pattern 4).
- **A tested default model:** a short list of tool-capable models Webforge has tested, marked by rough cost per reply, with a mid-priced one preselected. A model above a price threshold asks once before it is chosen.
- **Prompt caching** of the system text and tool definitions where the provider supports it.

## 7. Options

| Option | What the person does | Effort (ideal days) | Risks | Plan changes |
|---|---|---|---|---|
| **A. OpenRouter with the person's own account** (sign in with PKCE), plus local servers and any OpenAI-compatible server in *Advanced* | Signs in to OpenRouter in their browser (creating an account and buying credits from $5 there), picks a model, sets a limit | **13:**<br>• OpenAI-compatible streaming client with tool calls: 2<br>• PKCE sign-in, model list, ZDR flags: 1.5<br>• in-memory MCP client to 4.9's tool layer: 1<br>• assistant loop, context, caps, safety version: 2<br>• panel, review card, cost readout, Stop: 3<br>• consent screen, Preferences › Assistant, help: 1.5<br>• tests, incl. fake model, injection and marker tests: 2 | An OpenRouter account is one more sign-up (18+). Model behaviour varies, so the tested list must be kept up to date. Spend, though capped | GA9's v1.1 item gains OpenRouter as its first provider. One v1.1 item over 5 days, split into sub-issues. spec/01 §9 lines (AIA-10). A design note on #171 (AIA-4). An ADR for the provider layer and consent |
| **B. Webforge-provided credits** (Webforge's OpenRouter account issues capped per-user keys through its management API, or a proxy) | Nothing to sign up for; pays Webforge | **A + 15–25:** a Webforge account system, payments, a key-issuing server, abuse handling, a DPA and privacy notice, support. Plus running costs and VAT | Webforge becomes a processor of every user's content and responsible for their model-terms compliance (OpenRouter §5); close to "reselling API access" (§7). A server to keep up; the end of "no Webforge servers" | A new post-MVP item with licensing (MVP §8); spec/01's process model and §9 rewritten. **Not proposed for v1.1** |
| **C. Provider keys only** (OpenAI, Anthropic, Google) | Opens a developer console, sets up billing, copies a key | **12:** no PKCE, but a second client for Anthropic's native API and three sets of instructions | Pasting API keys is the step non-technical owners fail at. No cross-provider ZDR switch | As A, without OpenRouter |
| **D. Local models only** (Ollama, LM Studio) | Installs a model server and a model of several GB | **10:** no sign-in, no consent about third parties, a simpler consent screen | Most owners' computers can't run a tool-calling model well; quality and speed vary | As A, minus the network line in spec/01 §9 |

**Recommendation: A**, with D's local servers included at little extra cost (the same client):
- OpenRouter's PKCE sign-in is the only route here where a non-technical owner never sees an API key;
- the person's own account keeps Webforge out of the data path and out of billing;
- ZDR routing gives the strongest privacy default available short of a local model.

Direct provider keys aren't built at first, since OpenRouter's BYOK covers a person who already pays OpenAI or Anthropic. Webforge credits wait for licensing.

## 8. Proposed decisions

Every one is **⏳ Proposed** unless marked decided; the product owner decides.

| ID | Proposal | Effort | Plan changes it implies |
|---|---|---|---|
| AIA-1 | **The v1.1 assistant (GA9) uses OpenRouter first,** signed in with OAuth PKCE in the person's browser, on **their own OpenRouter account**, which pays. No key to copy in the usual case; a pasted OpenRouter key in *Advanced* | In AIA-12 | GA9 and spec/02's v1.1 row: "the user's own account (OpenRouter first)" |
| AIA-2 | **One OpenAI-compatible client** serves OpenRouter, **local servers** (Ollama, LM Studio) and *Another server…* (a base URL and an optional key) in *Advanced*. Direct OpenAI or Anthropic keys aren't built at first, because OpenRouter's BYOK covers them. Local models are offered with a note that quality depends on the model and the computer | In AIA-12 | Sharpens BS9-10's provider list |
| AIA-3 | **No Webforge-provided credits in v1.1.** Webforge takes no money for AI, runs no AI server, and never receives content. Revisit with licensing (MVP §8) | 0 | A line in spec/02 §7 |
| AIA-4 | ✅ **Decided (product owner, 2026-11-01), for 4.9's part:** 4.9 builds its tools so the assistant can reuse them. **The loop runs in main; tools come through an MCP client on the SDK's `InMemoryTransport`, connected to 4.9's tool layer.** The renderer only shows the conversation; no socket, pairing or key for the assistant; one definition of tools for AI apps and the assistant | 0 in 4.9 (a design note); 1 in AIA-12 | **#171:** "the MCP server is built as a factory that can be connected to the loopback transport or an in-memory one, so the v1.1 assistant uses the same tools" (no change to days) |
| AIA-5 | **Each change is one undo step labelled "AI (Assistant): …";** a safety version "Before the assistant's changes" at each conversation's first change; a review card with *Keep* / *Undo these changes* per reply, highlighted on the canvas; auto-apply by default with *Review before applying* as a setting. D7, S18 and Content mode apply as for AI apps | In AIA-12 | Glossary: **Assistant** (avoid "Copilot", "Agent", "Chatbot"). Confirms WF-2 and BS9-10 |
| AIA-6 | **Off by default, with consent that names who sees what** (§5.3): consent for the app at sign-in, and a yes per site the first time, remembered on this computer and never in the site file. *Turn off* deletes the key; *Stop using on this site* forgets that yes. Local models skip the third-party wording | In AIA-12 | spec/02's v1.1 row; the help page |
| AIA-7 | **Privacy defaults:**<br>• OpenRouter requests carry `provider.zdr: true` and `data_collection: "deny"`, and the model list comes from ZDR endpoints. *Advanced* can allow other endpoints, with a warning<br>• minimal context: the model reads through the tools; never Media files, Custom Code, credentials or Version History<br>• the conversation is kept in memory only<br>• logs hold the model id, token counts, cost and tool names, never content (marker-string test) | In AIA-12 | spec/01 §9 *Assistant* bullet (AIA-10) |
| AIA-8 | **Cost limits:**<br>• a monthly limit set at sign-in (default $5), enforced in main from `usage.cost`, with a warning at 80%<br>• at most 25 tool calls and a `max_tokens` per reply<br>• each reply's cost and the month's total shown in money<br>• a tested default model and a short tested list; a price warning above a threshold | In AIA-12 | — |
| AIA-9 | **Prompt-injection defences** (§6.4):<br>• the 4.8 tools only<br>• labelled data, and system text that calls site text untrusted<br>• hosts shown for new external links<br>• replies rendered without images, HTML or auto-opened links<br>• adversarial tests with a scripted fake model | In AIA-12 | The 5.6 security review gains the assistant |
| AIA-10 | **spec/01 §9 wording:**<br>• the *Network* bullet gains the assistant's requests ("when the person sends a message, to the provider they chose; nothing in the background")<br>• a new *Assistant* bullet carries AIA-6 and AIA-7<br>• the *AI apps* bullet's "Webforge itself sends nothing" stays, as it remains true of AI apps<br>• the exported-site rule is unchanged: it concerns the export, and the assistant adds nothing a person couldn't | 0 (docs, when the item is planned) | spec/01 §9; F-AI-1 unchanged |
| AIA-11 | **A legal check before release:**<br>• OpenRouter's terms (18+, model-terms flow-down) as they apply to a person using their own account through Webforge<br>• the GDPR and UK GDPR wording on the help page (§5.4)<br>• the UK transfer mechanism<br>• EU AI Act Article 50 | Product owner's time (about an hour of a solicitor's) | A pre-release checklist line for the v1.1 item |
| AIA-12 | **Size and place:** about **13 days** in v1.1 as GA9's item, split into sub-issues (over 5 days, the Phase 2 rule): client and sign-in (3.5), loop and tool bridge (3), panel and consent (4.5), tests (2). Starts after 4.9 merges, with an ADR first for the provider layer and consent | 13 | v1.1 plan: GA9's item gets its estimate and sub-issues; a new ADR |

**Open points for the product owner beyond the table:**
- **The default monthly limit:** $5 proposed.
- **Whether the assistant arrives in v1.1** as planned, or sooner, given that 4.9 lands the tool layer in November.
- **Whether *Review before applying* should be the default** for the first release, the more cautious choice, instead of auto-apply.

## 9. Not confirmed

- **OpenRouter:**
  - whether the PKCE callback accepts `127.0.0.1` rather than `localhost`;
  - whether a PKCE-issued key can carry a spend limit set by the app;
  - which leading models have ZDR endpoints today;
  - its Data Privacy Framework status;
  - the current DPA date (two versions seen);
  - the header that hides an app from rankings.
- **Anthropic:**
  - API retention: 30 days per the privacy centre (1 Jul 2026), against third-party claims of 7 days;
  - the ban on subscription sign-in in other apps, which comes from trade press only.
- **OpenAI:** whether any sign-in exists for third-party apps.
- **LM Studio:** the limits of its tool use.
- **Local hardware:** the memory figure for usable local tool-calling is my estimate.
- **Competitors:**
  - undo for Wix's Aria and Squarespace's Clarkson;
  - Framer's in-app Agent on branches;
  - 10Web's undo;
  - Canva's Free/Pro training default;
  - Figma's undo of agent changes (help centre and forum conflict);
  - Hostinger's training (terms and support page conflict);
  - Durable's current models and credits;
  - Squarespace's and Webflow's credits per plan.
- **Law:** whether EU AI Act Article 50 touches Webforge, and any change to its timetable.
- **Cost:** the per-reply figures in §4.2 are estimates from assumed token counts, not measurements.

## 10. Sources

All read on 1 Nov 2026 unless dated otherwise. Page dates are given where the page has one.

**OpenRouter.**
- Docs (undated): [OAuth PKCE](https://openrouter.ai/docs/use-cases/oauth-pkce) · [tool calling](https://openrouter.ai/docs/guides/features/tool-calling) · [data collection](https://openrouter.ai/docs/guides/privacy/data-collection) · [provider logging](https://openrouter.ai/docs/guides/privacy/provider-logging) · [privacy and logging](https://openrouter.ai/docs/features/privacy-and-logging) · [zero data retention](https://openrouter.ai/docs/guides/privacy/zdr) (with the 18 Oct and 27 Oct 2026 notices) · [BYOK](https://openrouter.ai/docs/use-cases/byok) · [guardrails](https://openrouter.ai/docs/guides/features/guardrails) · [management keys](https://openrouter.ai/docs/guides/overview/auth/provisioning-api-keys) · [usage accounting](https://openrouter.ai/docs/use-cases/usage-accounting) *(search snippet)* · [app attribution](https://openrouter.ai/docs/app-attribution) *(search snippet)*.
- [Pricing](https://openrouter.ai/pricing) (undated).
- [Terms of Service](https://openrouter.ai/terms) (updated 31 Aug 2026).
- [Data Processing Agreement](https://openrouter.ai/data-processing-agreement) *(search snippet; 5 May or 26 Aug 2026)*.

**Providers and local servers.**
- Anthropic: [How long do you store my organisation's data](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data) (1 Jul 2026); subscription sign-in in third-party apps: [WinBuzzer, 19 Feb 2026](https://winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn/) *(trade press)*.
- OpenAI: [Your data](https://developers.openai.com/api/docs/guides/your-data) *(search snippet)*.
- Ollama: [OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility).
- LM Studio: [OpenAI compatibility](https://lmstudio.ai/docs/developer/openai-compat) · [free for work](https://lmstudio.ai/blog/free-for-work) (8 Jul 2025).
- npm registry `latest` entries for the SDKs in §4.1 (1 Nov 2026).
- `@modelcontextprotocol/sdk` 1.32.2 `dist/esm/inMemory.d.ts` (`InMemoryTransport.createLinkedPair`).

**Competitors, hosted.**
- Wix: [AI service providers](https://support.wix.com/en/article/wixs-ai-service-providers-and-their-policies) · [sub-processors](https://support.wix.com/en/article/list-of-wixs-sub-processors) · [AI credits](https://support.wix.com/en/article/about-ai-credits) · [Aria in the Harmony editor](https://support.wix.com/en/article/wix-harmony-editor-working-with-aria) · [Studio AI code assistant](https://support.wix.com/en/article/studio-editor-using-the-ai-assistant-to-add-custom-code) (all undated) · Generative AI Policy (effective 1 Jan 2026).
- Squarespace: [AI partners](https://support.squarespace.com/hc/en-us/articles/16282290976013) (30 Oct 2026) · [AI Terms](https://www.squarespace.com/aiterms) (25 Jun 2026) · credits *(third party: lilachbullock.com, Oct 2026)*.
- Webflow: [sub-processors](https://webflow.com/legal/subprocessors) (9 Jul 2026) · [AI Terms](https://webflow.com/legal/ai-terms) (11 May 2026) · [AI on by default](https://webflow.com/updates/webflow-ai-enabled-by-default) (15 Jan 2026) · [AI credits](https://webflow.com/updates/ai-credits) · [AI attribution in the activity log](https://webflow.com/updates/ai-attribution-site-activity-log) (3 Jun 2026) · [AI Assistant help](https://help.webflow.com/hc/articles/34205154436243).
- Framer: [AI credits and plans](https://www.framer.com/blog/ai-credits-simpler-plans-and-lower-prices/) (16 Jun, updated 30 Oct 2026) · [credits help](https://www.framer.com/help/articles/how-ai-credits-and-agents-pricing-work/) (30 Oct 2026) · [AI Notice v1.2](https://www.framer.com/legal/ai-notice) (18 Sep 2026) · [external agents](https://www.framer.com/agents/external/).
- Hostinger: [integrated AI](https://www.hostinger.com/support/integrated-ai-in-hostinger-ai-builder-agentic-mode/) (13 Apr, updated 29 Oct 2026) · [Terms of Service](https://www.hostinger.com/legal/universal-terms-of-service-agreement) (29 Sep 2026) · [AI Builder pricing](https://www.hostinger.com/pricing/ai-builder) · [getting started](https://www.hostinger.com/tutorials/hostinger-horizons-getting-started/) (30 Oct 2026).
- Durable: [privacy policy](https://durable.com/privacy-policy) (20 Oct 2026) · [undo](https://help.durable.com/en/articles/15199758) and [regenerate](https://help.durable.com/en/articles/15199859) (21 May 2026) · TechCrunch (12 Dec 2023).
- 10Web: [privacy policy](https://10web.io/privacy-policy/) (21 Mar 2024) · [pricing](https://10web.io/pricing-platform/) · [AI chat editor](https://10web.io/blog/10web-ai-chat-based-website-editor/) (16 Mar 2026).

**Competitors, desktop and design.**
- Pinegrow: [AI Assistant](https://pinegrow.com/docs/ai-assistant/) (28 Nov 2025) · [Claude Code provider](https://pinegrow.com/docs/ai-assistant/claude-code/) (20 Sep 2025) · [smart HTML editing](https://pinegrow.com/docs/ai-assistant/smart-html-editing-with-ai/) (15 May 2025) · [disclaimer](https://pinegrow.com/docs/ai-assistant/ai-assistant-disclaimer/) (16 Sep 2025) · [MCP server](https://pinegrow.com/docs/ai-assistant/mcp-server-and-webmcp/) and [review AI changes](https://pinegrow.com/docs/ai-assistant/review-ai-changes/) (28 Sep 2026) · [API key guide](https://pinegrow.com/blog/how-to-set-up-your-api-key-for-pinegrow-ai-assistant-a-simple-guide/) (17 Dec 2024) · [local models thread](https://forum.pinegrow.com/t/running-pinegrow-ai-with-locally-installed-llm-ai-assistants/10042) *(forum)*.
- Bootstrap Studio: [AI assistant](https://bootstrapstudio.io/docs/ai-assistant.html) · [8.0 release](https://forum.bootstrapstudio.io/t/version-8-0-is-out/12646) (10 Feb 2026, with forum reports).
- RapidWeaver Elements: [Elements AI setup](https://docs.realmacsoftware.com/elements-docs/getting-started/elements-ai) · [using Elements AI](https://docs.realmacsoftware.com/elements-docs/using-elements/elements-ai) · [blog builder thread](https://forums.realmacsoftware.com/t/elements-ai-can-now-build-your-entire-blog/56862) (30 Jun 2026) *(forum)*.
- Figma: [our approach to AI](https://www.figma.com/ai/our-approach/) · [content training](https://help.figma.com/hc/en-us/articles/17725942479127) · [AI Terms](https://www.figma.com/legal/ai-terms/) (30 Oct 2026) · [agent help](https://help.figma.com/hc/en-us/articles/37998629035799) · [First Draft](https://www.figma.com/blog/figma-ai-first-draft) (24 Sep 2024) · credits *(third party: banani.co, 2026)*.
- Canva: [AI product terms](https://www.canva.com/policies/ai-product-terms/) (26 Jun 2026) · [privacy](https://www.canva.com/trust/privacy/) · [Canva Shield](https://www.canva.com/safe-ai-canva-shield/) · [admin controls](https://www.canva.com/help/magic-features-admin-controls/) · [AI top-ups](https://www.canva.com/help/ai-top-ups/) · [Canva Code](https://www.canva.com/help/canva-code-generated-interactive-elements/).

**Webforge.**
- Specs: [spec/01 §3, §8, §9](../../spec/01-architecture.md) · [spec/02](../../spec/02-mvp-spec.md) F-AI-1, F-ED-14 (D7) and the v1.1 rows · [spec/04](../../spec/04-implementation-plan.md) 4.4a, 4.8, 4.9.
- ADRs and reviews: [ADR 0006](../../docs/adr/0006-publishing.md) §4 · [ADR 0019](../../docs/adr/0019-code-trust.md) · [ADR 0021](../../docs/adr/0021-mcp-transport.md) · [security review](../../docs/reviews/2026-10-30-security-review.md) S18–S21.
- Research: [product/05](05-feature-gap-analysis.md) GA2, GA5, GA9 · [bootstrap-studio/06](../bootstrap-studio/06-bootstrap-studio-9.md) BS9-10 · [competitors/01](../competitors/01-webflow.md) WF-2 · [competitors/02](../competitors/02-pinegrow.md) · [product/06](06-editor-ui-ux-parity.md) UX-28 · [product/09](09-quick-start-wizard.md) QS-7.
- Code: `packages/commands/src/api.ts`, `packages/commands/src/commands.ts`, `apps/desktop/src/main/ai-ipc.ts`, `apps/desktop/src/main/credential-store.ts`.
