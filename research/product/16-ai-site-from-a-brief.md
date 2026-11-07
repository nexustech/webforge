# A whole site from one prompt: what AI apps need next

**Status:** ✅ Decided (AIB-1…AIB-10, §6, product owner, 7 Nov 2026: each as proposed). Recorded in `spec/02` (F-AI-1 and §7 item 33) and the plan: 4.11 ([#768](https://github.com/nexustech/webforge/issues/768)), 4.12a ([#769](https://github.com/nexustech/webforge/issues/769)) and 4.12b ([#770](https://github.com/nexustech/webforge/issues/770)).

**The product owner's question (7 Nov 2026):** refine the design of the Claude Desktop integration. Could Webforge build a site from a prompt such as this one, and what's missing?

> Create a website for a local motor repair garage, the website should have details of services offered (MOTs, car repair, bodyshop) information about the location of the business, contact information. The colour scheme is red and white, the company is called Rapidfix Vehicle Repair

**Goal:** a small-business owner describes their business to an AI app, checks one summary, and gets a site that is theirs: their name, services, address, contact details and colours. Every change can be undone, and nothing reaches the site without their say.

## 1. Method

Read against `main` at `213da889` (7 Nov 2026):
- **The tools AI apps see:** `apps/desktop/src/main/mcp-server.ts` (the server lists tools only: no resources or prompts), `packages/commands/src/queries.ts`, `commands.ts` and `ai-tools.ts`, and `APP_TOOLS` in `apps/desktop/src/shared/ipc/ai.ts`.
- **Limits and approvals:** `mcp-limits.ts` (120 queries and 30 commands a minute per app; a back-off after a decline), and the D7 confirmations in `commands.ts`.
- **The quick start:** `packages/templates/src/business.ts` (`businessDetailsSchema`, `withBusiness`), the recipes, and `BUSINESS_TYPES` and the business kinds in `packages/model/src/settings.ts`.
- **What's decided:** F-AI-1 in [spec/02](../../spec/02-mvp-spec.md), 4.8 and 4.9 in [spec/04](../../spec/04-implementation-plan.md), [ADR 0021](../../docs/adr/0021-mcp-transport.md), QS-1…QS-8 in [product/09](09-quick-start-wizard.md), and AIA-4 in [product/14](14-in-app-ai-assistant.md).

Effort is in ideal days against today's code.

## 2. What an AI app can do today

**Read (queries):**
- `outline`: the site's name, language, pages and shared sections, and its theme preset;
- `pageTree`: the elements on a page, in the Header and Footer, or in a shared section;
- `fields`: one existing element's fields and their schemas;
- `settings`: Site Settings' business details, read only;
- `theme`: the theme's tokens.

**Change (commands):**
- `addNode`, `updateFields`, `editText`, `moveNode` and `removeNode`;
- `addPage`;
- `setThemeTokens`.

**Act in the window:** `runSiteCheck` and `openPreview`.

Every change is one undo step named after the app. A version, *Before ‹app›'s changes*, is saved before an app's first change. Changes that reach every page wait for the person's **Allow**: the theme, a new page, the Header or Footer, or a shared section. So does any change to where visitors' money or details go. The tools work only on the site that's open.

## 3. The prompt, step by step

| The prompt asks for | Today | Why |
|---|---|---|
| Create a website | ❌ | No tool makes a site, chooses a template or runs the quick start; the person must make and open one first |
| Called Rapidfix Vehicle Repair | ⚠️ | The Header's site name and the Footer's text can be set, each with an **Allow**. Site Settings' name, which the Contact section and the structured data use, can't be set |
| Services: MOTs, car repair, bodyshop | ✅ | A Features section with three items, by `addNode` and `editText`, if the app knows the type is called `Features` (gap 1) |
| Location | ⚠️ | The Map section has its own address. Site Settings' address, used by the Contact section and search engines, can't be set |
| Contact information | ❌ | The Contact section and the opening hours draw on Site Settings, which apps can't change. Typing them into a Text element duplicates them, and they then go stale |
| Red and white | ✅ | `setThemeTokens`, with one **Allow** |
| Pictures (implied) | ❌ | No tool lists Media, adds a file or chooses a picture: the template's placeholders stay |
| Pages | ⚠️ | Pages can be added (an **Allow** each), but not removed, renamed, reordered, or given a search title and description |
| Found as a garage on Google | ❌ | *Trades*' business kinds are home and building trades (Plumber, Electrician…). There's no `AutoRepair`, so the structured data says *HomeAndConstructionBusiness* |

The quick start (3.11) already does most of what the prompt asks: Trades, a brand colour, the name, the contact details and the pages. But only a person can run it, by hand.

## 4. The gaps, most serious first

1. **The app can't learn what it may add.** `addNode` takes a type name, but nothing lists the 50 types or their fields. A wrong guess gets "There is no component…" with no list. `catalogue-data.json` already holds the catalogue as data for AI apps, but the server never offers it.
2. **No site from a brief.** Everything starts from a site the person has already made.
3. **Site Settings are read-only.** That blocks the name, description, address, phone, email, opening hours, social profiles, business type and search settings: the facts a small business's site is built on.
4. **Pages can only be added.** Removing, renaming, reordering and Page Settings (search title, description, *Hide from search engines*) are missing, so a template's spare pages stay.
5. **Too many interruptions for a whole build.** A site is roughly 5–10 **Allow**s and 40–80 undo steps, at 30 commands a minute. Each step is fine on its own; together they're a chore, and undoing the build is 80 clicks rather than one.
6. **No pictures.** An app can't see what's in Media, add a file, or put a picture in an Image or a section background.
7. **No garage business kind** for the structured data (§3).
8. **Connecting Claude Desktop.** Today it means copying an address and a key by hand. 4.9's desktop extension ([#764](https://github.com/nexustech/webforge/pull/764), in review) carries the address, so only the key is pasted, once, into the extension's secure setting. That paste stays by the product owner's choice (ADR 0021, decision 3), so it isn't a gap in this note.

## 5. The design

### 5.1 The quick start is the "make a site" tool

`createSiteFromBrief` takes the quick start's answers:
- business type and kind;
- name and *What you do*;
- the pages to include;
- a brand colour, or a palette;
- phone, email, address, opening hours and web address, each optional (QS-6).

Webforge never makes the site straight away. It opens the quick start **filled in with those answers**, on the step the person would check last, and the person reviews it and clicks **Create**. Every answer can be changed there. The tool answers once the person has created the site (with the new site open) or closed the quick start (`declined`). The open site is saved first, as when opening any site.

This reuses what exists: `withBusiness`, the recipes, the palettes and the quick start's own checks. It also keeps the rule that a person, not an app, decides when a new site is made.

For the prompt, that means:
- Trades, *Vehicle repair*;
- "Rapidfix Vehicle Repair";
- Home, Services and Contact;
- red as the brand colour on a white surface;
- whatever contact details the prompt gave. It gave none, so the app asks or leaves them for the person.

### 5.2 The catalogue, offered

- The server offers the catalogue as an MCP **resource**: `catalogue-data.json` as it is, read-only.
- A `components` query does the same for apps that don't read resources. It lists each type's place (section, element, child), label, description, fields, schemas and defaults.
- "There is no component…" lists the valid types for that place.

### 5.3 Site Settings, the business part

`updateSettings` changes the parts `settings` reads:
- `general`: name, description, language, business type and kind;
- `address`: the web address;
- `contact`;
- `social`;
- `search`.

It is never publishing, forms, analytics or code: those stay out of AI apps (F-AI-1). It's one undo step. Because the name and contact details show on every page, a change asks once (D7). Contact details are where visitors reach the business, so a change to the phone, email or a social profile also names the old and the new value, as S18 does for payment links.

### 5.4 Pages

- `removePage`, which asks first, like the person's own *Delete Page*, and never removes the home page or *Page not found*;
- `renamePage` and `movePage`;
- `updatePageSettings`: the search title, description, *Hide from navigation* and *Hide this page from search engines*.

Each is one undo step. Removing a page that other pages link to asks, as it does for the person.

### 5.5 One approval for a build

For a build that is more than a few edits, an app sends a **plan**: a list of the commands above with a short title, such as "Build the Rapidfix site". Webforge checks every command before showing anything.

The person then sees **one** summary: the pages added and removed, the theme change, the Site Settings changes (old → new), and the number of sections and elements. Each change that would have asked on its own is listed there. If they allow it:
- the plan runs as **one undo step**, "AI (Claude): Build the Rapidfix site", after a version saved before it;
- the per-minute limit counts the plan as one command.

If any command fails, nothing changes. This is WF-2's approve-before-apply and BS9-10's review mode, made for apps.

Small edits keep working as they do now.

### 5.6 Pictures, without fetching anything

- A `media` query lists Media: each file's id, name, kind, size and alt text. Apps can then put existing pictures in Image fields, as `updateFields` already allows.
- `requestMedia` asks the person for pictures: it opens Webforge's own *Add files* dialog with the app's reason, such as "Photos of your workshop and team". The app never gives a path, and the answer is the ids of what the person added.
- Downloading stock photos from the web is **not** proposed: Webforge sends nothing anywhere itself (F-AI-1). An app that fetched pictures would still need the person to add them.
- Site Check flags placeholder *text* but not the template's placeholder pictures. A tip, *Pictures from the template*, lists them, so the app (and the person) can see which to replace.

### 5.7 A prompt that knows the order

The server offers an MCP **prompt**, *Build a site from a description*. It tells the app the order:
1. `createSiteFromBrief`, or `outline` for an open site;
2. read the catalogue;
3. one plan for the pages, sections, theme and settings;
4. `runSiteCheck`;
5. `openPreview`;
6. say what the person still has to do: photos, the form service, publishing.

Claude Desktop shows server prompts in its prompt menu, so the person can start from it.

### 5.8 A garage, as a business kind

Add `AutoRepair`, labelled *Vehicle repair*, to Trades' business kinds, for the structured data (SEO-1). The Trades template and the Workshop theme already suit a garage, so no new template is needed.

### 5.9 What stays with the person

Choosing photos, the form service, analytics, publishing, Custom Code and passwords. These are where mistakes cost money, privacy or the live site, and F-AI-1 already keeps them out.

### 5.10 Content mode

F-AI-1 limits AI apps to content edits in Content mode, and refuses structural commands there. The new tools follow the same line:
- **Allowed:**
  - the catalogue and `media` queries;
  - `requestMedia`, since the person picks the files;
  - in `updateSettings`: the name, description, contact details, opening hours and social profiles;
  - in `updatePageSettings`: the search title and description.
- **Refused, like other structural commands:**
  - `removePage`, `renamePage` and `movePage`;
  - *Hide from navigation* and *Hide this page from search engines*;
  - in `updateSettings`: language, business type and kind, web address and search settings;
  - `createSiteFromBrief`;
  - a plan holding any command Content mode refuses. The whole plan is refused, and nothing in it is applied.

### 5.11 How it's tested

An E2E test with a scripted MCP client, with no model in the loop, runs the Rapidfix prompt as tool calls:
- brief → *Create* → plan → *Allow* → Site Check → preview;
- then it checks the site: the name everywhere, three services, the map's address, the Contact section's details, red buttons, and one undo step that takes the build back.

The same client checks each refusal: a plan with one bad command changes nothing, and a declined brief makes no site.

## 6. Decisions

Decided by the product owner on 7 Nov 2026, each as proposed. 4.12 is split into 4.12a (AIB-5, AIB-6: 5 days) and 4.12b (AIB-7…AIB-9: 3 days).

| ID | Decision | Days |
|---|---|---|
| AIB-1 | **The catalogue for apps:** an MCP resource and a `components` query from `catalogue-data.json`, and valid types listed in "There is no component…" | 0.5 |
| AIB-2 | **`updateSettings`** for the business part of Site Settings only, one undo step, asking once; contact details name old and new values | 1.5 |
| AIB-3 | **Page tools:** `removePage`, `renamePage`, `movePage`, `updatePageSettings`, with the person's own confirmations | 1.5 |
| AIB-4 | **`AutoRepair` (*Vehicle repair*)** joins Trades' business kinds | 0.25 |
| AIB-5 | **`createSiteFromBrief`:** opens the quick start filled in; the person creates the site | 2 |
| AIB-6 | **Plans:** many commands, one summary, one **Allow**, one undo step and one version; all or nothing | 3 |
| AIB-7 | **Pictures:** a `media` query, `requestMedia` through Webforge's own dialog, and a Site Check tip for the template's placeholder pictures. No downloads | 1.75 |
| AIB-8 | **The *Build a site from a description* prompt** offered by the server | 0.5 |
| AIB-9 | **The Rapidfix test:** an E2E run of the prompt by a scripted MCP client, with its refusals | 0.75 |
| AIB-10 | **Order:** AIB-1…AIB-4 first, as 4.11 *AI apps: settings, pages and the catalogue* (3.75 days), in Phase 4, on stream C right after 4.9, since without them an app can't finish an ordinary site. AIB-5…AIB-9 next, as 4.12 *AI apps: a site from a brief* (8 days), in **Phase 5** before 5.7, so Phase 4's milestone (19 Nov 2026) holds (§7). The in-app assistant (v1.1, AIA-4) gets all of it through the same server | – |

**Total:** 11.75 days. 4.11 is 3.75 days and 4.12 is 8, which is over 5 days, so it would be split when planned.

## 7. What it does to the dates

At Phase 3's measured pace (0.68 actual days per estimated day for plan items, `spec/04` §3):
- **4.11** is about 2.5 working days. Stream C's queue ends with 4.9, whose last part (the Claude Desktop extension, #764) is in review. 4.11 should therefore end about **13 Nov 2026**, inside Phase 4's milestone (**19 Nov 2026**). Phase 4 goes from 32 to 35.75 days.
- **4.12** is about 5.5 working days. In Phase 4 it would end about 20 Nov, past the milestone. So it goes to **Phase 5**, before 5.7 (pre-beta checks): Phase 5 goes from 46.5 to 54.5 days, and the total from 425.5 to 437.25. 19 Nov doesn't move.
- If Phase 5 can't take 4.12 either, it moves to v1.1 with the assistant: the person runs the quick start themselves, then asks the app to fill the site in. 4.11 alone makes that work end to end.

The changes, following CLAUDE.md's *Working the plan*:
- a line in `spec/02` §7, and F-AI-1's tool list;
- 4.11 and 4.12 in the plan's five places, with issues in the Phase 4 and Phase 5 milestones, and 4.11 at the end of stream C's queue;
- a scope-change line in `spec/04` §3;
- help: [ai-apps](../../docs/help/ai-apps.md) gains *Building a site from a description* when 4.12 merges (HP-4).
