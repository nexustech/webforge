# @webforge/site-check

Site Check's rules (F-CHK-1, X5, plan item 3.6): pure functions over the site document that the editor runs as the site changes, and before an export.

## Public API

`src/index.ts` is the only entry point.

- `checkSite(input, mode, ignored?, rules?)` → `CheckReport`: every rule's findings for an `"export"` or a `"publish"`, without what the person ignored.
- `SITE_CHECK_RULES`: the registry, in the panel's order. Later items add theirs here (forms 3.7, external resources 3.9).
- `levelIn(rule, mode)`: _Must fix_, _Should fix_ or _Tip_. Publishing makes the publish-strict rules _Must fix_.
- `blockingCount(report)`: the _Must fix_ findings, which stop an export or publish.
- `ignoreKey(rule, key)`: what _Ignore_ remembers for a finding.

## Rules

- Each rule has an `id`, a `level`, optionally `strictOnPublish`, and `check({ site, catalogue })`. It returns findings with a stable `key` and a `place` the panel can jump to: an element, a menu item, a page, an item in Media, the theme or the web address.
- What a rule knows besides the site comes in the input too: whether the owner confirmed the allowed addresses (`allowListConfirmed`, #649), and the year the site was last published in (`published`, F-CM-8), for the tip that its `{year}` is out of date.
- Rules read the components as data (`@webforge/site-components/catalogue-data`), never the components themselves. They leave out hidden elements, which aren't exported.
- Their words are in the app (`siteCheck.*` in `@webforge/i18n`), not here.
- Ignoring hides _Should fix_ findings and _Tips_ only. A _Must fix_ is always listed.
