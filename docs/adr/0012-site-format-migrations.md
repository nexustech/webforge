# 0012. Every change to a stored shape bumps the site format

- Status: Accepted
- Date: 2026-10-24
- Related: #247 (R14), F2 in [project file format](../../research/stack/06-project-file-format.md), [architecture §5](../../spec/01-architecture.md), [engineering standards §5](../../spec/03-engineering-standards.md), [ADR 0003](0003-wforge-sqlite-storage.md)

## Context
A site's documents carry a `formatVersion`. `migrateSite` (`packages/model/src/migrations.ts`) runs the migration chain from the stored version up to `SITE_FORMAT_VERSION`, then validates the result with `siteDocSchema`.

1.32 changed a Section's padding from one size (`"small"`, `"medium"`, `"large"`) to a box, a spacing token per side, without bumping the format. Instead, `box.ts` read the old sizes whenever it drew a Section (`LEGACY_PADDING`). That made two migration mechanisms:
- **The chain** runs once, when a site opens, and is tested by a fixture per format.
- **Read-time tolerance** is spread over every reader of the field: the canvas, the Edit panel, the export. It stays forever, isn't tied to a format, and an old shape survives in the file until someone edits that field.

The architecture review of 23 Oct 2026 asked for one mechanism.

## Decision
1. **Any change to what a stored document may hold bumps `SITE_FORMAT_VERSION`,** with a migration step and fixtures. This includes:
   - a new required field, or a field removed or renamed;
   - a value that changes shape, e.g. a size becoming a box;
   - a value whose meaning changes, e.g. a theme name becoming tokens.

   A new optional field that older sites simply don't have needs no bump, as long as leaving it out means what older sites meant. A document's optional `size` in Media (1.28) is one: a file imported before it has no size, which means its size isn't known.
2. **Readers read the current format only.** No code outside the chain accepts an old shape. A value that isn't valid in the current format reads as the field's default, as any invalid value does.
3. **Steps never change once a build with them has been released.** A shape change that slipped past a format, as 1.32's did, gets a new step: format 6 (`MIGRATIONS[5]`, `sectionPaddingBoxes`) moved `LEGACY_PADDING` into the chain, so sites already at format 5 are migrated too. Editing the format 4 → 5 step instead would have left them unmigrated.
4. **Every step has its own fixture** in `packages/model/test/fixtures/v<n>/`, holding the shape the step changes, and a test that checks the result. Fixtures are never deleted. The down-and-up property in `migrations.test.ts` has a hand-written inverse of each step: an arbitrary current site taken down to any older format must migrate back to the same site.
5. **Migrating never writes.** `ProjectStore.readSite` keeps the migrated site in memory; the first commit writes it with its changes, in one transaction (ADR 0003, decision 7).

## Consequences
- A shape change costs a step, fixtures and an inverse for the property, so it's visible in review. In exchange, readers stay simple and every old site is tested.
- The format number rises more often. That's free: it is only compared, never shown.
- An older build opens a site of a newer format read-only (`newer-format`), so a bump also stops older builds from writing shapes they don't know.
- **Not covered:** the clipboard's JSON carries no format version. A Section copied from a format 5 build and pasted into a format 6 one loses its padding size. Before the first release, give clipboard payloads a format version and run them through the chain.
