# 0016. Site Check's rules run in the renderer, from their own package

- Status: Accepted
- Date: 2026-10-27
- Related: #64 (3.6), F-CHK-1, X5, [architecture §2 and §7](../../spec/01-architecture.md), [ADR 0005](0005-export-pipeline-spike.md)

## Context
The architecture put Site Check in the pipeline: rules in `packages/pipeline`, run in the build worker as `Pipeline.check(snapshot, mode)`, as step 2 of an export.

Site Check is also a panel that is live: it updates as the person edits, and a finding jumps to its element and offers a *Fix*. Two things stood in the way of the worker:
- **The renderer can't reach the pipeline.** It never imports the packages that run in the main process or a worker (R16, `renderer-no-node-packages`). The pipeline also uses Node's `crypto`.
- **Each check would cost a round trip.** It would serialize the whole site, cross two processes and come back, on every pause in typing. Yet the rules only read the site document: links, names, alt text, theme colours, Media's sizes. None of them needs the rendered HTML, images or the disk.

## Decision
- **A package of its own:** `packages/site-check`, framework-free like the other core packages. It holds the rule registry and `checkSite(input, mode, ignored)`.
  - It reads the site document and the components as data (`@webforge/site-components/catalogue-data`, as `packages/commands` does), and the theme's contrast from `@webforge/themes`.
  - It never reads the components, the canvas engine or the editor.
- **It runs in the renderer:**
  - the panel checks the site at once, then again once it has been unchanged for 400 ms;
  - **a recheck runs in the renderer's idle time** (`requestIdleCallback`), as many rules as an idle period has room for and at least one, so no rule runs while the person types or a frame is due. A change while it runs starts it again. *Ignore* filters the latest findings again without running the rules;
  - File → Export runs `checkSite(…, "export")` before anything else, and stops on a *Must fix*.
- **Words live in the app.** Findings carry a rule id, a stable key, a place (an element, a menu item, a page, Media, the theme or the web address) and values, never text. The panel words them from `siteCheck.*`.
- **What the person ignored is UI state**, like the editor mode. It is kept in the site file's `meta` table, through the editor-state channel, never versioned or undone.

## Consequences
- **What a check costs** (`check-cost.test.ts`): a site of five of ADR 0007's large pages (225 elements each). Measured as the main thread's CPU time on a development machine (27 Oct 2026):
  - every rule together, about 27 ms;
  - the costliest, *Placeholder text*, 7 ms, then *Broken links* 4.7 and *Underlined text* 4.0; the rest under 3.5.
  - The test holds each rule to three copies of the site through JSON, about a frame's 16 ms on a development machine. It times the rule and the copy in alternating batches on the same runner and takes the median ratio, so a slow or busy runner slows both alike (#677): a fixed 16 ms failed on CI's Windows runners at 17.2 ms. A rule over it would need splitting, or work of its own across idle periods.
  - Two fast paths brought the costliest rules down: the model's link walk only parses strings with `href=` in them, and objects with a `kind`; *Placeholder text* skips the tag and entity patterns for plain text.
- **The export pipeline doesn't run Site Check.**
  - The build still refuses what it can't write (`reserved-name`, R16) and warns about broken links and missing images in its report.
  - The renderer's check comes first, so those refusals show up in Site Check before an export starts.
- **Publishing (4.5) runs `checkSite(…, "publish")` in the renderer the same way.** It is stricter (X5): broken links, a missing web address, placeholder text, unconfigured forms and missing titles become *Must fix*.
- **A rule that needs the rendered site cannot be written this way.** Examples are external requests found in Custom Code's output, or an image's bytes. Such a rule would run in the worker as part of the build and report back through the export's result. 3.9's external resources may be the first.
- **Later rules join the registry** (`SITE_CHECK_RULES`), with their words in `siteCheck.rule.<id>`: forms (3.7), external resources (3.9).
