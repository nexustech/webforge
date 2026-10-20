# @webforge/test-utils

Shared test fixtures (sample sites, one `.wforge` file per released format version) and helpers.

Fixtures:

- `sampleSite()`: a two-page `SiteSnapshot` (Header, Hero with photo, text, FAQ, About page, Footer) for pipeline and export tests.
- `heroPhoto()`: the fixture JPEG in `fixtures/media/hero.jpg` (1600×1000, generated, no rights issues).

**Status:** first fixtures (Phase 0 export spike).

## Public API
`src/index.ts` is the only entry point; import the package as `@webforge/test-utils`, never its internal files.

- `sampleSite()`, `heroPhoto()`: see above.
- `tempDirFactory(prefix?)`: call it in a test file; each call of the returned function makes a fresh temporary folder, deleted after the test.

## Boundaries
- Test-only: never imported by production code.
