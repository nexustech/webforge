# Webforge

A desktop visual website builder for **DIY small-business owners**. Users drag and drop sections, click to edit text, choose a theme, and publish a fast, **self-contained static website** (plain HTML/CSS/JS, no server, no CDN), to a folder/ZIP, FTP/FTPS/SFTP or Netlify.

**Status:** Phases 0–4 are complete and Phase 5 (beta hardening) is under way (13 Nov 2026). The live state is in the [GitHub milestones](https://github.com/nexustech/webforge/milestones) and the [implementation plan](spec/04-implementation-plan.md).

## Documentation

| Document                                                             | What it covers                                                                                                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [spec/01-architecture.md](spec/01-architecture.md)                   | Stack, process model, packages, data model, interfaces, decision register                                                                                                 |
| [spec/02-mvp-spec.md](spec/02-mvp-spec.md)                           | MVP features and acceptance criteria, components, milestones, licensing                                                                                                   |
| [spec/03-engineering-standards.md](spec/03-engineering-standards.md) | Toolchain, coding conventions, testing, CI, Definition of Done                                                                                                            |
| [spec/04-implementation-plan.md](spec/04-implementation-plan.md)     | MVP work breakdown, schedule, risks and open questions (live tracking in GitHub issues)                                                                                   |
| [research/README.md](research/README.md)                             | Research notes and the reasoning behind every decision                                                                                                                    |
| [docs/adr/](docs/adr/)                                               | Architecture decisions made during implementation                                                                                                                         |
| [docs/reviews/](docs/reviews/)                                       | Reviews of `main` and of the plan: architecture, security, accessibility, performance, plan feasibility, extensibility; each lists its findings and the issues they filed |
| [docs/components.md](docs/components.md)                             | How to write a site component                                                                                                                                             |
| [docs/extending.md](docs/extending.md)                               | Adding to the editor: areas, panels, commands, toolbars, kinds of field, IPC domains, strings, the test kit                                                               |
| [docs/branding.md](docs/branding.md)                                 | The app's name and icons, and what a rename changes                                                                                                                       |
| [docs/releasing.md](docs/releasing.md)                               | How a version gets from `main` to the people who use it: channels and staged rollout                                                                                      |
| [docs/site-zip.md](docs/site-zip.md)                                 | The format of a site's ZIP (_Save a Copy as ZIP_)                                                                                                                         |
| [docs/help/](docs/help/)                                             | The in-app help pages                                                                                                                                                     |
| [docs/beta/](docs/beta/)                                             | The beta: the testers' guide and how reports are triaged                                                                                                                  |
| [docs/testing/](docs/testing/)                                       | Tests only people can run, such as the usability test                                                                                                                     |
| [e2e/README.md](e2e/README.md)                                       | The Playwright suites: desktop app, exported sites, packaged app, visual regression, performance                                                                          |
| [CLAUDE.md](CLAUDE.md)                                               | Guidance for coding assistants: hard rules, commands, workflow                                                                                                            |
| [ideas.md](ideas.md)                                                 | Original brief                                                                                                                                                            |

## Getting started

Requires Node 24 and pnpm 12 (`npm install -g pnpm@12`; the exact version is pinned in `package.json`).

```sh
pnpm install   # also installs the git hooks (lefthook)
pnpm dev       # start the desktop app with hot reload
pnpm check     # lint, typecheck, package boundaries, unused code, licences, UI strings, help pages, React Compiler, tests with coverage, compiled tests
```

Repository layout: `apps/desktop` (Electron app), `packages/*` (model, history, commands, storage, engine, site-components, templates, themes, pipeline, publish, site-check, help, mcp-bridge, editor-ui, i18n, errors, test-utils), `e2e/` (Playwright tests) and `tools/` (repository scripts such as the licence check and the checks `pnpm check` runs). See [architecture §4](spec/01-architecture.md#4-package--module-structure-pnpm-monorepo).

## Stack at a glance

Electron 45 · React 19 + shadcn/ui · Tailwind v4 + daisyUI 5 · Puck (canvas engine) · Zustand + Immer (undo/redo) · SQLite `.wforge` files (better-sqlite3) · TypeScript 7 · pnpm + Turborepo · Biome · Vitest · Playwright · Storybook · electron-builder

## Platforms

Windows 10/11 x64 · macOS 13+ (Apple Silicon)

## Licence

Proprietary. All rights reserved. See [LICENSE](LICENSE).
