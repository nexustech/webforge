# 0026. The assistant: one OpenAI-compatible client in main, OpenRouter sign-in, consent, and the panel's contract

- Status: Accepted (2026-11-13; it carries the product owner's AIA-1…AIA-14, and fixes the panel's contract for 6.9c, #968)
- Date: 2026-11-13
- Related: 6.9a–d (#870–#873), AIA-1…AIA-14 ([product/14](../../research/product/14-in-app-ai-assistant.md) §8, decided 13 Nov 2026), PH6-5, [ADR 0021](0021-mcp-transport.md) (AI apps, whose tools the assistant reuses), [ADR 0019](0019-code-trust.md) (a yes remembered per site on this computer), [ADR 0006](0006-publishing.md) (Netlify's sign-in), [spec/01 §9](../../spec/01-architecture.md#9-security--privacy), WF-2, UX-28, BS9-10, S18–S21

## Context

The product owner decided the built-in assistant's design on 13 Nov 2026 (AIA-1…AIA-14), and pulled it into Phase 5 (PH6-5). Four items build it:

- **6.9a:** the provider client, sign-in and this ADR (stream B);
- **6.9b:** the loop in main, and the bridge to 4.9's tools (stream B);
- **6.9c:** the panel, the review card and consent (stream A);
- **6.9d:** writing help and the quick start's description step (stream C).

Stream A starts 6.9c as soon as this ADR merges, against a stand-in for main (#968). So besides the provider layer and consent, this ADR fixes **the contract between main and the panel**: the `assistant` IPC domain's calls and the events main pushes. A later change to it needs a note to stream A.

What product/14 established, and this ADR takes as given:

- **Who pays:** the person's own OpenRouter account, signed in with OAuth PKCE (AIA-1). Webforge takes no money and runs no server (AIA-3).
- **One client:** one OpenAI-compatible Chat Completions client serves OpenRouter, local servers (Ollama, LM Studio) and any other server the person names (AIA-2).
- **Tools:** the loop runs in main, and its tools come through an MCP client on the SDK's `InMemoryTransport`, connected to 4.9's tool layer (AIA-4). The renderer only shows the conversation.
- **Each change:** one undo step labelled "AI (Assistant): …", a safety version at a conversation's first change, and a review card with _Keep_ and _Undo these changes_. Changes apply at once by default; _Review before applying_ is a setting (AIA-5).
- **Consent:** off by default; a yes for the app at sign-in, and a yes per site, remembered on this computer and never in the site file (AIA-6).
- **Privacy defaults:**
  - zero-data-retention endpoints only, and `data_collection: "deny"`;
  - minimal context, read through the tools;
  - the conversation kept in memory only;
  - logs without content (AIA-7).
- **Cost:** a monthly limit, $5 by default, enforced in main, with a warning at 80%; at most 25 tool calls and a `max_tokens` per reply (AIA-8).
- **Prompt injection:** the defences in product/14 §6.4 (AIA-9).
- **spec/01 §9's wording** (AIA-10).

## Decision

### 1. Where it runs

```
renderer (panel)          main                                        outside
────────────────          ───────────────────────────────────         ──────────────
Assistant panel  ──IPC──▶ assistant loop ──HTTPS (net.fetch)───────▶ OpenRouter, or a
  text, steps    ◀─IPC──    │  ▲  SSE: text deltas, tool calls          local or named server
  review card               ▼  │
                          MCP client ══ InMemoryTransport ══ 4.9's MCP server (a third
                                                               "app": Assistant)
                                                                 │  AiBridge (S21)
                                                                 ▼
                                                      renderer: CommandApi → HistoryManager
```

- **The model call is made in main, never the renderer.** The renderer never holds a key and never makes a request off the computer. Its CSP is unchanged.
- **Main uses Electron's `net.fetch`,** which follows the system's proxy settings, as offices need.
- **No AI SDK.** Chat Completions with streaming is a `fetch` of SSE whose chunks zod checks (product/14 §4.1). One small client serves every OpenAI-compatible server and avoids a large dependency. The MCP SDK, which 4.9 already ships, is the only library the assistant uses.
- **The assistant reaches the site only through 4.9's tool layer,** as a third kind of app named _Assistant_, over `InMemoryTransport`:
  - no socket, no key and no pairing;
  - it works with _AI apps_ off;
  - every 4.9 rule applies to it unchanged: S18's confirmations, S19, S20's safety version and rate limit, S21's checks, the untrusted-text wording and content-free logs.
- **4.9's server, built per app, gains a constructor for the assistant** (6.9b). Its undo label prefix is `AI (Assistant): `, and its safety version is "Before the assistant's changes".

### 2. Providers

| Provider                 | Base URL                                     | Key                                        | Who sees the request                               |
| ------------------------ | -------------------------------------------- | ------------------------------------------ | -------------------------------------------------- |
| **OpenRouter** (default) | `https://openrouter.ai/api/v1`               | From sign-in (§3), or pasted in _Advanced_ | OpenRouter and the model's maker                   |
| **Ollama**               | `http://localhost:11434/v1`, editable        | None                                       | Nobody: it stays on this computer                  |
| **LM Studio**            | `http://localhost:1234/v1`, editable         | None                                       | Nobody                                             |
| **Another server…**      | Any `http:` or `https:` URL the person types | Optional, pasted                           | Whoever runs that server: the panel names its host |

- **One provider at a time,** chosen in Settings › _Assistant_, with its model and the monthly limit.
- **A key never travels unencrypted:** the client refuses to send one over plain `http:` to a server that isn't on this computer (`insecure-server`), so nothing of the site goes there either (#976). Over `https:`, or to `localhost`, `127.0.0.1` or `[::1]`, it goes.
- **Keys** live in 4.4a's credential store: `assistant/openrouter`, or `assistant/server` for _Another server…_. Never the site file, the settings JSON or logs.
  - A server's key was given for that server: changing its address, or the provider, forgets it, so it's never sent to another address. And a key never travels over plain `http:` to another computer: `setKey`, the model list and the chat client each refuse with `insecure-server` (#976, #870's review).
  - Where the store refuses (Linux's `basic_text` backend), the assistant can't sign in, and says why.
  - A key never leaves main: the renderer learns only whether there is one.
- **OpenRouter requests carry the privacy defaults** (AIA-7):
  - `provider: { zdr: true, data_collection: "deny" }`;
  - `usage: { include: true }`, for each reply's cost;
  - the attribution headers `X-OpenRouter-Title: {appName}` and `HTTP-Referer: <product web address>`, which carry no content;
  - no plugins (web search and the like).

  _Advanced_ › _Allow models that may keep requests_ drops `zdr` and `data_collection`, with a warning. It's off by default.
- **A local server counts as on this computer** when its host is `localhost`, `127.0.0.1` or `[::1]`:
  - the consent wording says nothing leaves the computer;
  - the per-site question is skipped;
  - no cost is counted.

  Any other host is _Another server…_, whose host the consent and the panel name.
- **The model list** (`assistant:models`):
  - **OpenRouter's** comes from `GET /api/v1/models?supported_parameters=tools`, kept only where `GET /api/v1/endpoints/zdr` lists a ZDR endpoint for the model, unless _Advanced_ allows the others.
    - A short list Webforge has tested comes first, marked _Tested_, with a mid-priced one preselected.
    - Each model shows its maker, and its rough cost per reply from its prices: product/14 §4.2's typical reply, 80k tokens in and 3k out.
    - A model whose typical reply costs more than $0.50 asks once before it's chosen.
  - **A local server's** comes from `GET <base>/models`, unpriced.

### 3. OpenRouter sign-in (OAuth PKCE)

Main runs it:

1. **Main makes the PKCE values:** a 32-byte random `code_verifier`, its S256 `code_challenge`, and a 16-byte random `state`.
2. **Main starts the callback listener** before the browser opens:
   - on a fresh random port on loopback (`127.0.0.1`, and `::1` where the computer has it);
   - with path `/callback`;
   - closed after its first valid callback, on _Cancel_, or after 10 minutes, the code's own lifetime.
3. **Main opens the person's browser** (`shell.openExternal`) at `https://openrouter.ai/auth?callback_url=http://localhost:<port>/callback&code_challenge=…&code_challenge_method=S256&state=…&key_label=…`.
   - OpenRouter documents localhost callbacks on any port. It doesn't document `127.0.0.1`, so the URL says `localhost`, and the listener answers on both loopback addresses.
   - `key_label` is "{appName}, ‹the date the key was made›", so the person can find the key in their account. It never names the computer: host names are often the person's own name, and OpenRouter would keep it with the key for no need.
4. **The callback:**
   - It must carry the same `state`. Anything else gets a 400, and the sign-in carries on waiting.
   - Its `Host` must name the listener (DNS rebinding, as for the preview server, S24).
   - The page it answers says "You can close this tab and go back to {appName}", with no script and no outside resource.
5. **Main exchanges the code:** `POST https://openrouter.ai/api/v1/auth/keys` with `{ code, code_verifier, code_challenge_method: "S256" }`, and the answer's `key` goes to the credential store.

**Why this is safe:**

- A program that squats the port and catches the code can't use it without the verifier, which never leaves main.
- A page that calls the listener fails the `state` and `Host` checks.

**When the browser can't reach the listener** (a locked-down office machine, say), _Sign in with a code_ starts the flow without `callback_url`. OpenRouter then shows the code, and the person pastes it into {appName}. PKCE is required in this mode, and the exchange is the same.

**Turn off** deletes the key from this computer. The panel links to OpenRouter's keys page, where the person can revoke the key itself.

**Whether OpenRouter lets an app set a spend limit on the key is unconfirmed,** and its PKCE guide shows no such parameter. So the monthly limit (§5) is enforced by Webforge, in main.

### 4. Consent

| Question                                                                                                      | Asked                                                                               | Remembered                                                                                                  |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **The app's:** product/14 §5.3's points 1–5 (what's sent, to whom, who pays, customers' details, turning off) | Once, when the person turns the assistant on, before sign-in or choosing a server   | In main's assistant settings, with the wording's version: a later wording that changes the facts asks again |
| **The site's:** "Use the assistant on ‹Site›? Its content will be sent to ‹OpenRouter and the model's maker›" | The first time the panel is used on a site, unless the provider is on this computer | Per site, on this computer, by the site's id, as ADR 0019 remembers code trust. Never in the site file      |

- **The yes is keyed by site.** A site sent to someone else doesn't carry the yes, and a site someone sends you doesn't arrive with it.
- **_Stop using on this site_** forgets that site's yes. **_Turn off_** deletes the key, and keeps the yeses, which name no secret.
- **The app's yes is for the reach it was given for** (#992's review): this computer, OpenRouter, or a named server by its host, as the wording names who receives what. A consent for a local model said only that nothing leaves the computer, so a switch to OpenRouter or a server, or to another server's host, needs the person's yes again: `status.enabled` is false, with `consentReach` saying what the consent covered, and the panel shows the consent again. Any consent covers a model on this computer.
- **Main refuses `assistant:send` without both yeses** (`consent-needed`), so a panel bug can't send a site's content unasked.

### 5. Cost and the monthly limit

- **Each reply's cost** comes from OpenRouter's `usage.cost` in the last streamed chunk, in US dollars as OpenRouter bills. A server that doesn't give a cost counts as costing nothing, and its replies show no cost.
- **The month's total:**
  - main adds each reply's cost to it, in its assistant settings, by calendar month in the computer's time zone, with no content;
  - at 80% of the limit, main says so once that month;
  - at 100%, `assistant:send` answers `limit-reached` until the next month or a higher limit. A reply under way when the limit is passed finishes its current model call, then stops.
- **Per reply:**
  - at most 25 tool calls;
  - `max_tokens: 4096` on each model call;
  - at most 12 model calls.

  Reaching any of them stops the reply, and says which.

### 6. What the conversation holds, and logs

- **The conversation is per site and kept in main's memory.**
  - It's dropped when the site closes, Webforge quits, or the person starts a new conversation.
  - It's never written to the site file, settings, logs or crash reports.
- **The context sent is minimal** (product/14 §5.2):
  - the person's message;
  - the selected section or element and its page, by id and title;
  - what the model asks for through the read tools.

  It never includes Media files, Custom Code, publish settings, credentials or Version History.
- **Logs** keep the provider's kind, the model's id, token counts, cost and tool names. A marker-string test (6.9b, `assistant-defences.test.ts`) plants a marker in a site's text, a message, a model reply, a tool's arguments and a window's failure, and finds it in no log, console or file.

### 7. The `assistant` IPC domain: the panel's contract

Scaffolded with `pnpm scaffold ipc-domain Assistant` as `apps/desktop/src/shared/ipc/assistant.ts`, `window.webforge.assistant`. Every argument and event is checked with zod. The types below are that file's `z.infer` types; 6.9a writes the schemas to match.

```ts
/** A site open in the window, as the `project` domain names it. */
type SessionId = string;

/** Where requests go (§2). Never a key: only whether there is one. */
type AssistantProvider =
  | { kind: "openrouter"; signedIn: boolean }
  | { kind: "ollama" | "lmstudio"; baseUrl: string }
  | { kind: "server"; baseUrl: string; hasKey: boolean };

/** Whether requests leave this computer: the consent's wording, and whether a site is asked. */
type Reach = "this-computer" | "openrouter" | "server";

type AssistantModel = {
  id: string; // "anthropic/claude-sonnet-4.5", as the provider names it
  name: string;
  maker: string | null; // "Anthropic"; null for a local model
  tested: boolean; // on Webforge's tested list (§2)
  zdr: boolean; // has a zero-data-retention endpoint (OpenRouter only)
  perReplyUsd: number | null; // rough cost of a typical reply; null when unpriced
  pricey: boolean; // over the threshold: asks once before it's chosen
};

type AssistantStatus = {
  enabled: boolean; // the app's consent given and not turned off
  consentVersion: number | null; // the app consent's wording the person agreed to
  /** Where that consent was given for (§4); a provider it doesn't cover leaves `enabled` false. */
  consentReach: { reach: Reach; host?: string } | null;
  provider: AssistantProvider;
  reach: Reach;
  model: AssistantModel | null;
  month: { spentUsd: number; limitUsd: number; warned: boolean; reached: boolean };
  reviewBeforeApplying: boolean; // AIA-5's setting: always false, and not shown, until 6.9b stages commands (below)
  allowRetainingModels: boolean; // Advanced (§2); false by default
};

type AssistantSettings = Partial<{
  provider:
    | { kind: "openrouter" }
    | { kind: "ollama" | "lmstudio"; baseUrl?: string }
    | { kind: "server"; baseUrl: string };
  modelId: string;
  monthlyLimitUsd: number; // 1–1000
  reviewBeforeApplying: boolean;
  allowRetainingModels: boolean;
}>;

/** What the person had selected when they sent the message (§6). */
type MessageContext = { pageId?: string; nodeId?: string };

type SignInResult = {
  status:
    | "signed-in"
    | "cancelled"
    | "timed-out"
    | "refused"
    | "keychain-unavailable"
    | "offline"
    | "insecure-server" // a key for an http: server not on this computer: never kept (#976)
    | "failed";
};

/** Why a message wasn't sent, or a reply stopped early. */
type AssistantErrorCode =
  | "consent-needed" // the app's or this site's yes is missing (§4)
  | "not-signed-in"
  | "no-model"
  | "limit-reached" // the month's limit (§5)
  | "busy" // a reply is already under way for this site
  | "no-site" // the session isn't the site open in the window
  | "offline" // the provider couldn't be reached
  | "unauthorized" // the provider refused the key (revoked?): sign in again
  | "no-credit" // OpenRouter: 402, the account has run out
  | "rate-limited"
  | "model-unavailable" // the model or a ZDR endpoint for it isn't there now
  | "provider-error" // any other refusal or malformed answer from the provider
  | "insecure-server" // a key would go over plain http: to a server not on this computer (#976)
  | "failed";

type SendResult = { status: "sending"; replyId: string } | { status: AssistantErrorCode };

/** IPC channels (`assistant:*`): request → response. */
interface AssistantApi {
  status(): Promise<AssistantStatus>;
  /** The app's consent (§4): `version` is the wording shown. `false` is Turn off: it deletes the key. */
  setEnabled(enabled: boolean, version: number): Promise<AssistantStatus>;
  update(settings: AssistantSettings): Promise<AssistantStatus>;

  /** OpenRouter sign-in (§3). `browser`: the callback; `code`: OpenRouter shows a code to paste. */
  signIn(mode: "browser" | "code"): Promise<SignInResult>;
  /** The code the person pasted, after `signIn("code")`. */
  finishSignIn(code: string): Promise<SignInResult>;
  /** Stops a sign-in waiting for its callback or code. */
  cancelSignIn(): Promise<void>;
  /** A key pasted in Advanced: OpenRouter's, or Another server's. Checked with one request first. */
  setKey(key: string): Promise<SignInResult>;

  models(): Promise<{ status: "ok"; models: AssistantModel[] } | { status: AssistantErrorCode }>;

  /** This site's consent (§4); `asked` is false until the person has answered. */
  siteConsent(session: SessionId): Promise<{ asked: boolean; allowed: boolean }>;
  setSiteConsent(session: SessionId, allowed: boolean): Promise<void>;

  /** Sends a message in the site's conversation; the reply comes as events with `replyId`. */
  send(session: SessionId, text: string, context: MessageContext): Promise<SendResult>;
  /**
   * A one-off draft of the site's text (6.9d, #873; below): one model call with no tools, outside
   * the conversation. The same checks as `send`; its cost is added to the month's (§5).
   */
  draft(session: SessionId, request: DraftRequest): Promise<DraftResult>;
  /** Stops the reply: no further model call or tool call. Changes made stay, and stay undoable. */
  stop(replyId: string): Promise<void>;
  /** Forgets the site's conversation (the panel's New conversation). */
  newConversation(session: SessionId): Promise<void>;
  /** The site's conversation so far, for a panel opened again: main keeps it, in memory (§6). */
  conversation(session: SessionId): Promise<ConversationTurn[]>;
  /**
   * Opens a link from a reply in the person's browser, once they've clicked it. `href` is the
   * address as the reply wrote it: the panel's Markdown token's `href`, not normalised. Main opens
   * it (as `new URL(href).href`) only if it's an `http:` or `https:` address that reply holds in
   * main's own copy of the conversation: its text contains `href` (for a bare `www.` address,
   * without the `http://` Markdown added), or a review card's link is it. So a renderer can't use
   * the call to open anything else. No pattern runs over the reply, which is model output of up to
   * 200k characters: a plain search, so a reply built to stall a pattern can't freeze main
   * (#1001's review). Nothing is logged but the outcome.
   */
  openLink(
    session: SessionId,
    replyId: string,
    href: string,
  ): Promise<{ status: "opened" | "refused" | "failed" }>;

  /** Calls `listener` with each event below. Returns a stop function. */
  onEvent(listener: (event: AssistantEvent) => void): () => void;
}
```

**Events main pushes** (`assistant:event`). They're in order per reply. A reply's events name its site's session and the reply; `limit` and `status` are the app's, and name no session, as main has none to name for them with no site open:

```ts
/** A change one tool call made: one undo step (§1). */
type ReplyStep = {
  entryId: string; // the HistoryManager entry, for Undo these changes
  label: string; // "AI (Assistant): Edited Hero text"
  /** Where it changed the site, for the review card to show on the canvas; none for a site-wide change. */
  target?: { pageId: string; nodeId?: string };
};

/** A link to another website the reply added or changed, by its host as a browser reads it (S18). */
type ReplyLink = { host: string; href: string };

/** One exchange of the conversation, as `conversation()` gives it back. */
type ConversationTurn = {
  replyId: string;
  message: string; // what the person sent
  reply: string; // the reply's text so far: whole once it has ended
  state: "replying" | "done" | "failed";
  stop?: "end" | "stopped" | "tool-cap" | "model-call-cap" | "max-tokens" | "limit-reached";
  error?: AssistantErrorCode;
  costUsd: number | null;
  steps: ReplyStep[];
  links: ReplyLink[];
  /** The safety version this reply saved before its first change (S20): its `safety-version` event's. */
  safetyVersion?: { versionId: string; label: string };
};

/** A reply's events, about one site's conversation. */
type ReplyEvent = { session: SessionId } & (
  | { type: "reply-started"; replyId: string; model: string }
  /** Streamed text. The panel shows it as plain text with limited Markdown: no images or HTML. */
  | { type: "text"; replyId: string; delta: string }
  /** A tool call starting, and how it came out. Read calls carry no step. */
  | { type: "tool"; replyId: string; callId: string; tool: string; state: "running" }
  | {
      type: "tool";
      replyId: string;
      callId: string;
      tool: string;
      state: "done" | "refused" | "declined" | "busy" | "invalid" | "failed";
      step?: ReplyStep;
    }
  /** The first change of a conversation saved a version first (S20). */
  | { type: "safety-version"; replyId: string; versionId: string; label: string }
  /** The reply has ended, with its cost and the month's total, and the review card's content. */
  | {
      type: "reply-done";
      replyId: string;
      stop: "end" | "stopped" | "tool-cap" | "model-call-cap" | "max-tokens" | "limit-reached";
      costUsd: number | null; // null: the provider gives none
      month: { spentUsd: number; limitUsd: number };
      steps: ReplyStep[]; // every step of the reply, in order: the review card
      links: ReplyLink[];
    }
  | { type: "reply-failed"; replyId: string; error: AssistantErrorCode; steps: ReplyStep[] }
);

/** The app's events, about no one site: they carry no session. */
type AppEvent =
  /** The month's total crossed 80%, or reached the limit (§5). Once each, per month. */
  | { type: "limit"; level: "warning" | "reached"; month: { spentUsd: number; limitUsd: number } }
  /** The status changed in main: sign-in, Turn off, settings, a new month. */
  | { type: "status"; status: AssistantStatus };

type AssistantEvent = ReplyEvent | AppEvent;
```

- **`reply-done` closes every reply that `reply-started` began,** or `reply-failed` does: nothing else comes for that reply. A reply that changed nothing has empty `steps`, and the panel shows no review card.
- **_Undo these changes_ runs in the renderer,** on the `HistoryManager` the panel's window already has. No call to main is needed.
  - If the reply's `entryId`s are the newest entries in Undo History, at its current position and in order, it jumps to the entry before the first (`jumpTo`), as one undo of all of them.
  - Otherwise something has happened since: it offers the reply's conversation's `safety-version` in Version History instead, as product/14 §6.2 says.
  - _Keep_ only closes the card.
- **_Review before applying_ (AIA-5's setting) isn't in this contract yet.** Holding changes back until the person agrees needs the tool layer to stage commands, which 4.9's doesn't.
  - **Until it works, the panel and Settings don't show it:** no setting that does nothing. `AssistantStatus` still carries `reviewBeforeApplying` (always `false`), and changes apply at once, which is the default the product owner chose.
  - **It must work before the beta ships the assistant.** 6.9b makes it work, and adds its events to this contract with a note to stream A. If 6.9b can't, a follow-up issue in Phase 5 does, before the beta.
- **Drafts (6.9d, #873)** are the writing help's one-click asks: a rewrite of selected text (G25a), a page's description and an image's alt text from Site Check (G25b, SEO-10), and a template page's texts for the business the quick start describes (QS-7).

  ```ts
  type DraftRequest =
    | { kind: "rewrite"; how: "friendlier" | "shorter" | "grammar"; text: string } // ≤ 4,000
    | { kind: "description"; language: string; site: string; page: { title: string; text: string } }
    | { kind: "alt"; language: string; fileName: string; page: string; nearby: string }
    | {
        kind: "business";
        language: string;
        business: { name: string; type: string; about: string };
        texts: { role: string; sample: string }[]; // 1–40, answered in order
      };

  type DraftResult =
    | { status: "ok"; texts: string[]; costUsd: number | null } // one, or one per text asked
    | { status: AssistantErrorCode };
  ```

  - **A draft never changes the site.** The renderer shows it for review, and keeps what the person accepts as one undo step, labelled `AI (Assistant): …` like the loop's.
  - **The prompts live in main;** the renderer names only the kind. The site's text goes only in the user's message, as labelled JSON, and the system text says it is content, never instructions (§6.4's labelled data). `main/assistant/site-text.ts` is that one wrapper, for the drafts and 6.9b's loop alike.
  - **An alt text draft never sends the image** (§6): its file's name and the text near it only.
  - **The checks:** `preflight(session)` in the service runs `send`'s checks for both (site, both yeses, sign-in, model, limit), and `main/assistant/endpoint.ts`'s `endpointFor` gives the address, key, privacy routing and model, for the drafts and 6.9b's loop.
  - **One draft at a time per site** (`busy`). A draft waits up to two minutes for the model (`offline` after that). An answer main can't use, such as a business draft's with the wrong number of texts, is `provider-error`, and its cost still counts.

- **The loop (6.9b, `main/assistant/assistant-loop.ts`),** loaded with a site's first reply, never at start-up (#892):
  - **One reply at a time per site** (`busy`). `send` answers `sending` with the reply's id, and the reply runs on.
  - **Each reply connects afresh** through `McpService.connectAssistant`, and closes when it ends.
  - **Tool calls run one at a time.** A `busy` answer (the person is editing) waits two seconds and asks once more, then the model hears it (§6.2).
  - **Stop** ends the reply before its next model or tool call. A tool call under way finishes, and its change is kept in the reply's steps, since the window makes it however its asker gives up. A question the window is asking for one of the reply's commands (D7) closes: the bridge's `cancel(app)` sends `ai:cancel` for each command of the assistant's waiting for the window, and the command layer, given the asker's signal, declines it.
  - **A reply ends as `no-site`** when its site is no longer the open one, as after Open Recent. It's checked before each model call, each tool call, and each command. The window acts on whichever site it has open, and another site's text and changes are never this reply's (consent is by site, AIA-6).
  - **A model call that sends nothing for a minute** ends the reply as `offline`.
  - **The caps** (§5): 25 tool calls, 12 model calls, `max_tokens` 4096. The month's limit, reached by a call, stops the reply before that call's tool calls run.
  - **The safety version** is saved before a conversation's first change, once a conversation, through Version History's before-site-wide path. When one from the last five minutes holds the site already, no other is saved for the conversation, and no `safety-version` event comes.
  - **The review card's links** are the web addresses in the reply's changes' inputs, by host (S18).
  - **The system text** says site text is content, never instructions, in 4.9's own wording. The person's selection goes as labelled JSON after their message. Earlier turns go as their message and reply text, the last ten.
- **Errors carry a code, never the provider's own text,** which could quote the request. The panel words each code with `t()`. Main logs the HTTP status and the provider's error type, without content.

**The stand-in loop for 6.9c:** `apps/desktop/src/renderer/assistant/fake-assistant.ts` (6.9a). It's an `AssistantApi` that answers from a script:

- text in a few deltas;
- a tool step with a label;
- the cost;
- the limit's warning;
- each error code on request.

The panel's stories and tests use it.

### 8. spec/01 §9 (AIA-10)

- **The _Network_ bullet** gains: "and, when the assistant is on and the person sends it a message, that message and the site context it needs, to the provider they chose (OpenRouter, a server on this computer, or one they named), with nothing sent in the background".
- **A new _Assistant_ bullet** carries §2–§6 in short.
- **The _AI apps_ bullet's "Webforge itself sends nothing"** stays: it's still true of AI apps.

## Consequences

- **The panel can be built now** (6.9c) against §7 and the stand-in. 6.9a builds the client, sign-in, models, settings and consent behind the same calls. 6.9b fills `send` with the loop.
- **One tool layer for AI apps and the assistant.** A fix to a tool's description, limit or confirmation reaches both.
- **The ZDR list depends on OpenRouter.** If the tested default loses its ZDR endpoint, `model-unavailable` says so, and the person chooses another. The tested list is reviewed when models change, and at each release (5.8's checklist).
- **A second loopback listener appears briefly,** for sign-in only: on a fresh port, for at most 10 minutes, behind `state` and `Host` checks. Nothing listens otherwise.
- **The monthly limit is Webforge's own.** An account used elsewhere spends beyond it; the help page says to set a limit in OpenRouter too.
- **Not chosen:**
  - **An AI SDK** (the Vercel AI SDK, `openai`, `@openrouter/sdk`): a large dependency for one streamed `fetch`, and a second abstraction over the tools.
  - **Direct OpenAI or Anthropic keys:** OpenRouter's BYOK covers them, and Anthropic's API isn't Chat Completions (AIA-2).
  - **Calling `CommandApi` in-process:** a second definition of the tools, which would drift from 4.9's (AIA-4).
  - **The conversation kept on disk:** against "never store site content".
- **Revisit:**
  - if OpenRouter lets an app set a key's spend limit;
  - if a provider offers sign-in for third-party apps;
  - or when 6.9b settles _Review before applying_.
