# @webforge/site-check

Site Check's rules (F-CHK-1, X5, plan item 3.6): pure functions over the site document that the editor runs as the site changes, and before an export.

## Public API
`src/index.ts` is the only entry point.

- `checkSite(input, mode, ignored?, rules?)` → `CheckReport`: every rule's findings for an `"export"` or a `"publish"`, without what the person ignored.
- `SITE_CHECK_RULES`: the registry, in the panel's order. Later items add theirs here (forms 3.7, external resources 3.9).
- `levelIn(rule, mode)`: *Must fix*, *Should fix* or *Tip*. Publishing makes the publish-strict rules *Must fix*.
- `blockingCount(report)`: the *Must fix* findings, which stop an export or publish.
- `ignoreKey(rule, key)`: what *Ignore* remembers for a finding.

## Rules
- Each rule has an `id`, a `level`, optionally `strictOnPublish`, and `check({ site, catalogue })`. It returns findings with a stable `key` and a `place` the panel can jump to: an element, a menu item, a page, an item in Media, the theme or the web address.
- Rules read the components as data (`@webforge/site-components/catalogue-data`), never the components themselves. They leave out hidden elements, which aren't exported.
- Their words are in the app (`siteCheck.*` in `@webforge/i18n`), not here.
- Ignoring hides *Should fix* findings and *Tips* only. A *Must fix* is always listed.
