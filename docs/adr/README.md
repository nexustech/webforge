# Architecture Decision Records

Decisions made **during implementation** are recorded here, one file per decision: `NNNN-short-title.md`. Planning-phase decisions live in [`../../research/`](../../research/README.md) and are summarised in the [decision register](../../spec/01-architecture.md#11-decision-register).

## Index

| ADR                                            | Title                                                                                                      | Status                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------- |
| [0001](0001-monorepo-tooling.md)               | Monorepo tooling setup                                                                                     | Accepted                          |
| [0002](0002-licence-check.md)                  | Licence check with pnpm's built-in report                                                                  | Accepted                          |
| [0003](0003-wforge-sqlite-storage.md)          | `.wforge` storage on better-sqlite3: packaging, journal mode and untrusted files                           | Accepted; amended by 0020         |
| [0004](0004-puck-with-webforge-history.md)     | Puck runs under Webforge's own undo history: go                                                            | Accepted                          |
| [0005](0005-export-pipeline-spike.md)          | Export pipeline: site components, static build and file:// output                                          | Accepted                          |
| [0006](0006-publishing.md)                     | Publishing: publisher core, Netlify, credentials                                                           | Accepted                          |
| [0007](0007-large-page-performance.md)         | Editing a large page: performance check                                                                    | Accepted                          |
| [0008](0008-roomier-canvas-layout.md)          | A roomier canvas: maximised window, narrower side columns, one panel per column                            | Accepted; point 3 amended by 0011 |
| [0009](0009-colour-refs.md)                    | Colour references: theme roles and shades, or a field's own hex colour                                     | Accepted                          |
| [0010](0010-react-compiler.md)                 | The React Compiler memoizes the editor, and a check keeps it compilable                                    | Accepted                          |
| [0011](0011-layers-always-visible.md)          | Layers is always visible, under the left column's tabs                                                     | Accepted; amends 0008             |
| [0012](0012-site-format-migrations.md)         | Every change to a stored shape bumps the site format                                                       | Accepted                          |
| [0013](0013-store-gate.md)                     | A second connection writes large blobs, behind a store gate                                                | Accepted                          |
| [0014](0014-time-budgets-under-load.md)        | Time in tests, on a busy machine                                                                           | Accepted                          |
| [0015](0015-preview-server.md)                 | The preview server: where it listens, who can open it, what it builds                                      | Accepted                          |
| [0016](0016-site-check-in-the-renderer.md)     | Site Check's rules run in the renderer, from their own package                                             | Accepted; amended by 0018         |
| [0017](0017-site-code-in-the-export.md)        | The site's own code in the export                                                                          | Accepted                          |
| [0018](0018-publishing-from-a-version.md)      | Publishing: the worker publishes a version, destinations beside the site                                   | Accepted                          |
| [0019](0019-code-trust.md)                     | Code trust: the owner confirms code from someone else's site file                                          | Accepted                          |
| [0020](0020-storage-format-2.md)               | Storage format 2: what a version records, and the first schema migration                                   | Accepted                          |
| [0021](0021-mcp-transport.md)                  | AI apps reach Webforge over loopback HTTP, and Claude Desktop through a bundled extension                  | Accepted                          |
| [0022](0022-benchmarks.md)                     | Benchmarks: compared with `main` in one CI job                                                             | Accepted                          |
| [0023](0023-app-scheme-and-canvas-boundary.md) | The editor's own scheme, and what may run in the canvas                                                    | Accepted                          |
| [0024](0024-update-feed-and-channels.md)       | Updates: GitHub Releases as the feed, with Beta and Stable channels                                        | Accepted                          |
| [0025](0025-collections.md)                    | Collections: an item is a page, wrapped in its collection's shared design                                  | Accepted                          |
| [0026](0026-assistant.md)                      | The assistant: one OpenAI-compatible client in main, OpenRouter sign-in, consent, and the panel's contract | Accepted                          |

## Template

```markdown
# NNNN. Title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD
- Related: (research note / spec section / decision IDs)

## Context

What problem or constraint led to this decision?

## Decision

What we decided.

## Consequences

What becomes easier or harder; follow-up work.
```
