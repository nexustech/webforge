# Spending $250 of Claude cloud credits on Webforge

**Date:** 30 Oct 2026 · **Commit:** `main` at `c602885` (Phase 3 exit re-plan)

## Summary
The day-to-day stream work (Phase 4 items) will happen anyway and is paid for out of normal usage. Credits that are about to expire are best spent on **work that needs a lot of reading in one go, that nobody has scheduled yet, and that is worth more done now than later**. Four pieces of work fit that best:

| # | Work | Share | About | Why now |
|---|---|---|---|---|
| 1 | **Security audit and threat model** of the app as it stands, plus the Phase 4 attack surface | 35% | $85 | Publishing, credentials, OAuth and the MCP server land 2–13 Nov. The plan's security review (5.6) is 2 days in Phase 5, *after* they ship |
| 2 | **Architecture review, second pass** | 20% | $50 | The 23 Oct review looked at ~2.7k lines of desktop code. It is now ~87k (≈170k lines across the repo) |
| 3 | **Design ahead of the risky Phase 4–5 items:** MCP server (4.9), Version History (4.6), auto-update (0.5) | 15% | $40 | Each has an open question (Q1, Q9) or a data-loss risk. Settling the design first is cheaper than fixing it after the PR |
| 4 | **Robustness tests:** fuzzing the parsers and migrations, and an accessibility pass on the exported templates | 15% | $35 | Untrusted inputs are about to arrive: project ZIP import (4.7), AI apps (4.9), beta users' own files |
| – | **Reserve:** fixing what 1–4 find | 15% | $40 | A finding is only worth something once it's fixed |

The dollar figures are a way to split the budget, not quotes. What a session costs depends on the model, the effort level and how much it reads. Run item 1 first, check the spend in your usage page, and scale the others to fit.

**Order:** start 1 and 2 today, in parallel (they're independent). Start 3 once 1 has reported, so the MCP design can use the threat model. Run 4 alongside 3. Keep the reserve until the findings are in.

---

## 1. Security audit and threat model (≈35%)

### Why this is the best use of the money
The security work already done is careful. A quick look at `main` confirms it:
- `security.ts`: sandbox, context isolation, `webSecurity`, denied window opens, navigation guards, and a permission handler.
- A generated CSP in the renderer's `index.html`.
- Credentials kept in the OS keychain (`credential-store.ts`).
- SFTP checks the host key fingerprint.
- `bundle-download.ts` accepts `https://` only and refuses local and network hosts.
- Custom Code is sanitised everywhere except the export.

So the audit's job isn't to find the basics missing. Its job is to **verify that the controls hold everywhere and to cover the surface that is about to grow.** The plan's own risk R10 already names the MCP server as a risk and points to 5.6. 5.6 is two days in Phase 5, after 4.2–4.9 have merged. Doing it now lets the Phase 4 PRs build the fixes in from the start.

### What it should cover
| Area | Files to start from | Questions to answer |
|---|---|---|
| Renderer → main trust boundary | `apps/desktop/src/main/ipc.ts`, `shared/ipc-contract.ts`, `shared/ipc/*`, `preload/` | Does every channel check its sender and zod-parse what it's given? Can a compromised renderer read or write any path, or start a network request to an address it picks? |
| Custom Code and the sanitiser | `packages/site-components/src/catalogue/custom-code.tsx`, `sanitizeCustomCode`, `rich-text.tsx`, `renderer/add/section-preview.tsx` (`sandbox="allow-same-origin"`) | Can sanitised HTML still run script in the editor, which has the preload API? Try mXSS, SVG, `<math>`, `srcdoc`, CSS `url()`. Does Rich Text's `dangerouslySetInnerHTML` only ever see trusted markup? |
| Opening untrusted files | `packages/storage`, site-format migrations (ADR 0012), `.wforge` opening, `media-protocol.ts`, `media-import.ts` | Can a crafted `.wforge` (someone sends a site to a friend; a beta tester shares one) crash the app, run code, or read files outside the site? |
| Local servers | `preview-server.ts`, `preview-ipc.ts`, `network-address.ts`, `preview-live-reload.ts` | The phone preview listens on the LAN. Is the path unguessable? Is path traversal blocked? DNS rebinding? What can another device on the café Wi-Fi reach? |
| Downloads | `bundle-download.ts`, `bundle-net.ts` | Redirects, IPv6 and decimal-IP tricks, size limits, content types, and TOCTOU between the DNS check and the connection |
| Publishing and credentials (Phase 4) | `packages/publish/src/*` (FTP, FTPS, SFTP, Netlify), `netlify-auth.ts`, `credential-store.ts` | FTPS certificate checks, SFTP first-connection trust, OAuth `state` and PKCE, token scope, where tokens could leak (logs, crash reports, errors crossing IPC), and that remote clean-up deletes only Webforge's own files |
| MCP / AI apps (4.8, 4.9) | `ai-ipc.ts`, `packages/commands`, spec/04 R10 and Q9 | A threat model *before* 4.9 is built: transport, per-app tokens, approval UX, prompt injection carried in site content, rate limits, and what must never be reachable (publish, credentials, Custom Code) |
| Exported sites | `packages/pipeline`, ADR 0017, the consent banner, GA4 | Can site content break out of an attribute or a script and run on visitors' pages? Is GA4 truly gated behind consent? |
| Packaging | electron-builder config, Fuses, `asar` integrity | Fuses set as intended (RunAsNode off, cookie encryption, `onlyLoadAppFromAsar`). Groundwork for 0.5 |
| Dependencies | `pnpm-lock.yaml`, `patches/` | `pnpm audit`, and what the patched packages change |

### What to get back
- `docs/reviews/2026-11-xx-security-review.md` with a threat model (assets, attackers, trust boundaries) and findings ranked by severity, each verified in code with a file and line, in the format of the architecture review.
- A `type/bug` issue for each high or medium finding, in the current milestone.
- Acceptance criteria added to 4.2, 4.3, 4.4 and 4.9 wherever the audit changes what they must do.
- 5.6 becomes a re-check of these findings, not a first look.

### Prompt to paste into a new cloud session
> Do a security audit of Webforge on `main`. Read CLAUDE.md, spec/01-architecture.md §3 and §9, spec/04's risk R10 and question Q9, and docs/reviews/2026-10-23-architecture-review.md first. Use a workflow: one reviewer per area in the table in docs/reviews/2026-10-30-cloud-credits-plan.md §1, then a verifier for each finding that tries to disprove it in the code, writing a failing test where it can. Write a threat model and the verified findings, ranked by severity, to docs/reviews/2026-11-xx-security-review.md, in the architecture review's format. Open a draft PR (`docs(reviews): …`, `Refs #81`). Don't fix anything yet. List the issues you'd open, and wait for my go-ahead before opening them.

The prompt asks for a workflow by name, because CLAUDE.md's process only runs multi-agent orchestration when you ask for it. This is the session where many parallel reviewers are worth paying for.

---

## 2. Architecture review, second pass (≈20%)

The 23 Oct review (findings R1–R17) is a week old. Since then the codebase has grown about thirtyfold in the desktop app:

| Package | Lines (approx.) |
|---|---|
| `apps/desktop` | 87k |
| `site-components` | 20k |
| `engine` | 14k |
| `editor-ui` | 11k |
| `model` | 10k |
| `pipeline` | 6k |
| others | 20k |

It also has 17 ADRs and three phases of new features. Things worth asking:
- **Is R1–R17 done?** Check each finding against `main` and its issue. Close what is fixed, and say what is still true.
- **New hot spots.** `apps/desktop/src/main` has around 60 modules, and `index.ts` and `project-session.ts` were already large. Does the Puck adapter (R5's `CanvasSync`) still hold up after Phases 2–3? How large are `Editor.tsx` and `EditPanelHost.tsx` now?
- **Phase 4 readiness.** Are the publish package's interfaces (`Publisher`, manifest, `run.ts`) a good fit for 4.4–4.6? Does Version History (4.6) fit the storage design in ADR 0003, or will it need a format change (site format 10 → 11)?
- **Spec drift.** Do spec/01 and spec/03 still describe the code? Amend whichever is wrong.
- **Performance.** Use `pnpm e2e:perf` and ADR 0014's budgets to check the main-thread findings from 23 Oct (autosave, media import, export memory).

**What to get back:** `docs/reviews/2026-11-xx-architecture-review-2.md`, and issues for the new findings.

> Do a second-pass architecture review of Webforge on `main`. Start with docs/reviews/2026-10-23-architecture-review.md: check each of R1–R17 against the code and its GitHub issue. Then review what Phases 2–3 added (spec/04, docs/adr/0008–0017). Focus on main-process structure, the Puck adapter, the renderer's large components, the publish package's fitness for 4.4–4.6, and storage's fitness for Version History (4.6). Use a workflow with one reviewer per package group and a verification pass. Write docs/reviews/2026-11-xx-architecture-review-2.md and open a draft docs PR. List the issues you'd open and wait for my go-ahead.

---

## 3. Design ahead of the risky items (≈15%)

These items carry the most risk of being built twice. A short design note or ADR before the stream picks each one up is cheap insurance.

| Item | Open decision | Output |
|---|---|---|
| **4.9 MCP server** | Q9: loopback Streamable HTTP with per-app tokens, or a stdio bridge? Approval UX, which tools to expose, prompt injection. Check which AI desktop apps can actually connect to each option today | ADR 0018, built on the threat model from §1, and updated acceptance criteria on #171 |
| **4.6 Version History** | Snapshots or diffs in the `.wforge`; size limits; restore as an undoable step; what "republish this version" means against the publish manifest | ADR, and a migration plan if the site format changes |
| **0.5 / 5.2 auto-update** | Q1: the update-feed host (Cloudflare R2 with electron-updater's generic provider, or a public releases repo). Delta updates, rollback, and how a beta user who never updates is handled | ADR draft, ready for when signing enrolment (0.1) completes |
| **4.7 project ZIP** | Zip slip, zip bombs, and how an imported project is validated before it is opened | Acceptance criteria on #75 |

> Read spec/04 Phase 4 and Phase 5, questions Q1 and Q9, ADR 0003, ADR 0006 and the security review from docs/reviews/. Write design ADRs for 4.9 (MCP transport and approvals), 4.6 (Version History storage) and 0.5 (update feed). Research current MCP client support on the web where needed. Propose acceptance-criteria changes for #171, #74, #75 and #15. Open a draft docs PR, and don't edit issues until I approve.

---

## 4. Robustness and quality tests (≈15%)

Work that is valuable but never urgent enough to be put in a stream's queue:
- **Fuzz the sanitiser** (`sanitizeCustomCode`) with fast-check and known XSS payload lists. It is hand-written and guards a renderer that holds the preload API.
- **Property tests for site-format migrations.** The 23 Oct review found no fast-check properties for migrations although `siteDocArbitrary` exists, and the site format has since reached version 10. The property: any valid older document migrates to a valid current one, and re-migrating changes nothing.
- **Corrupt `.wforge` files:** truncated, wrong schema, huge blobs, and a newer format version. Each must give a clear message, never a crash or a half-open site.
- **Exported-site accessibility:** run axe on every page of every template on Desktop and Mobile (`pnpm visual` already does this) and fix what the beta's small-business owners' visitors would hit. This is cheaper than 5.5 doing it all at once.
- **Coverage gaps:** list any package under the 80% / 90% thresholds and add tests where the missing lines are risky ones, not just to reach the number.

> Add robustness tests to Webforge: fast-check fuzzing of sanitizeCustomCode, property tests for every site-format migration using siteDocArbitrary, and tests that a corrupt or newer .wforge file opens to a clear message. Fix any bugs you find, with a regression test for each. Follow CLAUDE.md's workflow: one PR per area, `pnpm check` passing, `/code-review high`.

---

## Reserve (≈15%): fix the findings
Keep this until §1–§4 have reported, then spend it on the high-severity findings, one PR each. Point a session at an issue and let it follow CLAUDE.md's normal Definition of Done.

## What not to spend the credits on
- **Feature work that is already planned and estimated.** It happens either way, and the streams' pace is what the plan measures.
- **`/code-review max` on every small PR.** Save the max level for the security-sensitive Phase 4 PRs: 4.2, 4.3, 4.4 and 4.9.
- **More competitor research.** `research/` already has nine Bootstrap Studio notes and a gap analysis. What it doesn't yet have is a security or failure-mode view.
- **Template copy and photos.** These need the product owner's review whatever drafts them (Q6), so the bottleneck isn't tokens.

## Tips for getting the most from each dollar
- **Start a fresh cloud session for each piece of work above.** Each one then reads only what it needs, and they run at the same time.
- **Ask for a workflow explicitly** in §1 and §2 ("use a workflow"). Fanning out to parallel reviewers with a verification pass is where a large budget buys accuracy you can't easily get in one session.
- **Ask for a report and a draft PR before any issues or fixes,** so you choose what gets fixed and the reserve isn't spent on low-value findings.
- **Check your usage after the first session** and resize the shares in the table to what is left.
