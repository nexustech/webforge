# AI apps that work while you're away

**Status:** 🟡 For decision (UA-1…UA-6). Nothing here is in the plan.

**Date:** 2026-11-20

**The question,** from the product owner: an AI app can't run unattended in Webforge. How can that be fixed, for example with an option to approve automatically or an autopilot mode, and how do competitors handle it?

## 1. What stops an app today

Read from the code on `main`; the app wasn't run.

| What                                                                                                                                                                   | Where                                                         | Effect on an unattended run                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| **A change that reaches every page asks first** (D7): the theme, a page added with a menu entry, a page deleted, Site Settings, the Header or Footer, a shared section | `confirmationAt`, `packages/commands/src/command-checks.ts`   | The app stops until someone clicks **Allow**         |
| **A change to where visitors' money or details go asks always** (S18), even on one page                                                                                | `confirmationFor`, same file                                  | The same                                             |
| **The question lasts 60 seconds,** then counts as declined                                                                                                             | `CONFIRM_TIMEOUT_MS`, `packages/commands/src/api.ts`          | A person who steps away refuses without knowing      |
| **After a decline the app must wait** 15 seconds, doubling to 5 minutes                                                                                                | `DECLINED_BACK_OFF_MS`, `apps/desktop/src/main/mcp-limits.ts` | Each missed question makes the next wait longer      |
| **A plan is one question** for up to 200 changes                                                                                                                       | F-AI-1                                                        | Helps, but the plan's question runs out the same way |
| **Pictures come only through Add Files…**                                                                                                                              | AIB decisions, [note 16](16-ai-site-from-a-brief.md)          | Each request needs the person                        |
| **No export or publish tool**                                                                                                                                          | F-AI-1                                                        | The run can't finish with a site on disk             |

A site of five pages needs about 10 to 16 answers.

What already protects the site, with or without a question: a version is saved before an app's first change (_Before app's changes_); every change is one named step in Undo History; an app has no tool for publishing, credentials, Custom Code, forms or analytics; Content mode limits it to content; and its requests are rate-limited. So the most an app can do unasked is change the open site in ways one click takes back. Nothing it does reaches visitors until the person publishes.

## 2. What others do

From their documentation on 2026-11-20 (links in [Sources](#sources)); none was run.

| Product                       | Asks by default                                 | Can it run without asking                                                                                                 | What still asks, or the safety net                                                 |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Claude Desktop** connectors | Each tool, or each kind (reading, writing)      | Per tool: _Always allow_, _Needs approval_ or _Blocked_; organisations can fix these                                      | The tool's own checks                                                              |
| **Claude Code**               | Edits, commands, network                        | Modes from asking each time to accepting edits, to a model that decides, to asking nothing; allow and deny rules per tool | Deny rules hold in every mode; a checkpoint per request                            |
| **Cursor**                    | A model reviews what isn't on the allowlist     | _Run Everything_; allowlists for commands and MCP tools                                                                   | Separate switches keep deleting files and leaving the workspace asked; checkpoints |
| **VS Code Copilot**           | Each tool                                       | _Allow once_, _in this session_, _always_; a level that allows all                                                        | Organisation policy; checkpoints                                                   |
| **Webflow** MCP               | Nothing in Webflow                              | Yes, by default                                                                                                           | Roles and an activity log                                                          |
| **Wix** MCP                   | Nothing in Wix                                  | Yes, publishing included                                                                                                  | Left to the AI app                                                                 |
| **WordPress.com** MCP         | Off until turned on, per site and per operation | Not found                                                                                                                 | Roles                                                                              |
| **Lovable, Bolt, Replit**     | A plan at most, then they build to the end      | Yes, that is the product                                                                                                  | Version history and restore points                                                 |

Three patterns:

1. **The website builders don't ask at all.** They rely on roles, a log and version history.
2. **The developer tools ask by default and let the person choose how much.** The choice is per tool or per session, the riskiest actions keep their own switch, and a checkpoint makes the rest cheap to take back.
3. **Nobody lets a silent timeout count as "no" and then slows the agent down.** That is ours alone.

Webforge is stricter than all of them, and already has the safety net the permissive ones rely on.

## 3. Principles

- **The person chooses how much to be asked,** per app, and can see at a glance that an app is working unasked. The default stays as it is.
- **A question is for what Undo can't put right.** Where visitors' money or details go (S18) always asks, and publishing stays the person's alone.
- **Walking away is not a refusal.**
- **Coming back, the person sees what was done** and can take all of it back at once.

## 4. Proposals

Sizes are rough ideal days.

| #        | Proposal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Why                                                                                                                          | Size |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---- |
| **UA-1** | **A question waits for its answer.** It stays until the person answers, the site closes or the app gives up; the app is told it is still waiting. Running out is no longer a decline, and causes no wait                                                                                                                                                                                                                                                                                                    | Today's 60 seconds turns a coffee break into a refusal and a penalty. Smallest fix, and worth doing whatever else is decided | 0.5  |
| **UA-2** | **"Work without asking"** for one app, in **AI Apps** and offered in the question itself (_Allow_ · _Allow, and don't ask again while this site is open_). While it's on, changes that reach every page are made unasked. It ends when the site closes, when the person turns it off, or after a time they chose (1 hour by default). The title bar's icon says an app is working unasked. Never unasked: where visitors' money or details go (S18), starting a new site, and anything Content mode forbids | This is the autopilot. It lasts one sitting and belongs to one site, so a forgotten setting can't surprise anyone next week  | 2    |
| **UA-3** | **"While you were away".** When an app has worked unasked, Webforge shows what it did when the person returns: the changes by page, and **Undo All**, which goes back to the version saved before                                                                                                                                                                                                                                                                                                           | Unasked work is safe only if it is seen. The version and the undo steps exist; this puts them in front of the person         | 1.5  |
| **UA-4** | **A folder of pictures the app may use.** The person chooses a folder once (**Pictures _app_ may use**); the app can list it and add files from it to Media. Webforge still downloads nothing, and the app sees nothing outside that folder                                                                                                                                                                                                                                                                 | The second thing that needs a person today. A folder is a clear, narrow grant                                                | 1.5  |
| **UA-5** | **An app can export** to a folder the person chose for it in **AI Apps**. Publishing stays the person's                                                                                                                                                                                                                                                                                                                                                                                                     | A run can end with a site to open from disk                                                                                  | 1    |
| **UA-6** | **Questions collect.** In place of UA-2: an app carries on with what needs no question, and the ones that do wait in a list the person answers together                                                                                                                                                                                                                                                                                                                                                     | Keeps every question, but the app builds on changes not yet allowed, and the list is long to read                            | 2.5  |

**Recommended:** UA-1 now; then UA-2 with UA-3, which belong together; UA-4 next. UA-5 if the trial of [Webforge's own website](../../docs/testing/own-website-with-claude-code.md) shows it is missed. Not UA-6: UA-2 and UA-3 do the same with less to read.

**Risks of UA-2.** An app that misreads the request can restyle the whole site unasked: the version and **Undo All** answer that. Text on a page can try to instruct the model that reads it: the app still has no tool that sends anything anywhere or reaches visitors, and S18 keeps asking. Developer tools can't check who answers at Webforge's address (ADR 0021): unchanged by this, since the setting is kept in Webforge, not in the tool.

**What changes if adopted:** F-AI-1's "declined after 60 s" (UA-1) and "waits for the user" (UA-2); the AIB decision that pictures come only through **Add Files…** (UA-4); the help page [AI apps](../../docs/help/ai-apps.md).

## Sources

- Claude Desktop connectors: <https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities>
- Claude Code: <https://code.claude.com/docs/en/permission-modes>, <https://code.claude.com/docs/en/permissions>, <https://code.claude.com/docs/en/checkpointing>
- Cursor: <https://cursor.com/docs/agent/security/run-modes>, <https://docs.cursor.com/agent/chat/checkpoints>
- VS Code: <https://code.visualstudio.com/docs/agents/run/approvals>, <https://code.visualstudio.com/docs/copilot/chat/chat-checkpoints>
- Webflow: <https://developers.webflow.com/mcp/reference/how-it-works>
- Wix: <https://dev.wix.com/docs/sdk/articles/use-the-wix-mcp/about-the-wix-mcp>
- WordPress.com (a press report, not WordPress's own page): <https://thenextweb.com/news/wordpress-com-mcp-write-capabilities-ai-agent>
- Lovable, Bolt, Replit: <https://docs.lovable.dev/features/plan-mode>, <https://support.bolt.new/building/using-bolt/rollback-backup>, <https://docs.replit.com/replitai/checkpoints-and-rollbacks>
