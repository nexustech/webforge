# 0019. Code trust: the owner confirms code from someone else's site file

- Status: Accepted
- Date: 2026-10-31
- Related: #649, [security review](../reviews/2026-10-30-security-review.md) (S1, S6), [ADR 0017](0017-site-code-in-the-export.md), [ADR 0018](0018-publishing-from-a-version.md), [architecture §9](../../spec/01-architecture.md), C7, F-ED-15

## Context
A `.wforge` file is checked for integrity (ADR 0003), but not for the code inside it. That code is:
- Settings' Custom Code: Head, End of page and Script;
- each Custom Code element;
- the addresses Settings allow.

An export wrote it as it stood, and Preview ran it in the owner's everyday browser from `127.0.0.1`. A "starter site" from a freelancer or a forum could skim every visitor's form under the owner's domain. In Simple mode the owner never sees Custom Code, and Site Check passed it (S1, S6). The file can't vouch for itself, so whatever records trust must live outside it.

## Decision
- **Code is trusted per site and per piece, on this computer only.**
  - Main keeps `code-trust.json` in the app's user data (`main/code-trust.ts`).
  - Each site's entry is keyed by its project id and holds the SHA-256 of each trusted piece's text, never the text, at most 1,000 per site (the oldest go first).
  - A copy of a site that keeps its project id matches only pieces its owner already trusted, which are the same code.
  - A damaged file is read as empty: the owner is asked again.
- **A piece becomes trusted in two ways:**
  - **The owner writes it here.** A `props` edit (a field, Settings' Custom Code) that adds a piece's text trusts that text once the owner stops writing, if the site still has it (`renderer/editor/code-trust.ts`). A paste, an added section, Undo, Redo or opening a file trusts nothing.
  - **The owner confirms it.** Before an export, a Preview or a Preview on Phone, the window lists the pieces main doesn't trust:
    - *Keep the code* trusts them.
    - *Leave it out* builds without them, this time only.
    - *Review* opens the first piece and stops.
    The wording was approved by the product owner on 31 Oct 2026.
- **Main builds only trusted code, whatever the renderer sends.** It filters the snapshot an export or a preview is built from (`withTrustedCode`, through `withRunnableCode` in the pipeline). When the record can't be read, none of the site's code goes in.
  - A pipeline preview run with no `runsCode` runs none of the site's code. An export or publish run runs all of it.
  - CSS isn't code that runs, and is always built.
- **Site Check applies the allow-list only once it is confirmed** (`allowListConfirmed`, ADR 0017). The export checks the site without the code the owner leaves out.
- **Paste in Simple mode leaves out Custom Code** (`advancedOnly` elements), with a toast.
- **Alternatives:**
  - *A flag in the site file.* The file would vouch for itself.
  - *Trust a whole site at once.* One edit by the owner would launder a stranger's script in the same site.
  - *Strip code on open.* That would destroy code the owner wrote elsewhere and moved here, and every legitimate starter template's widgets.

## Consequences
- An owner who opens their own site on a new computer is asked once, and keeps it with one click.
- **4.5 (publish):** its job carries a `SiteDoc` (ADR 0018 §3). Main must filter it with `withKeptCode` and the site's `trusted` predicate before the job, and the renderer must ask through `codeTrust.confirm` before publishing, as the export does.
- **4.6 (Version History):** restoring a version must not count as the owner writing the code. A restore that records a `props` step would trust what the version holds, so it should use another kind of step, or trust nothing.
- The Site Check panel shows the allow-list as unconfirmed until main answers, a moment after the site opens.
