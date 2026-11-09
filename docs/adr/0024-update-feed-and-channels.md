# 0024. Updates: GitHub Releases as the feed, with Beta and Stable channels

- Status: Accepted
- Date: 2026-11-09
- Related: [spec/04 items 0.5a and 0.5b](../../spec/04-implementation-plan.md) (#849, #850), 5.2 (the release workflow), open question Q1 ([spec/04 §9](../../spec/04-implementation-plan.md)), [stack/01](../../research/stack/01-electron-vs-tauri.md), MVP §6

## Context

Webforge has to update itself: its users won't look for new versions, and a fix that never reaches them doesn't help them. Electron's usual answer is electron-updater, the companion of electron-builder, which packages the app already. It needs a feed: a place to read the newest version's description (`latest.yml`) and download its installer.

Q1 asked where that feed lives. When the repository was private, GitHub Releases would have needed a token inside the app, so the default was a Cloudflare R2 bucket read through electron-updater's generic provider. The repository has been public since 23 Oct 2026, so its releases can be read without one.

Three more things shaped the decision:

- **Signing.** Code-signing enrolment (0.1) is still under way. On macOS, Squirrel.Mac installs no update that isn't signed by the same developer as the running app. On Windows, an unsigned update installs, but electron-updater checks the installer's signature only once the app knows its publisher (`publisherName`).
- **How Webforge quits.** It closes its site, lets each feature finish its last writes, then calls `app.exit`. That never emits Electron's `quit` event, which electron-updater installs on.
- **Testing it.** An update can only be tested end to end by installing a version, serving a newer one and letting the first update itself.

## Decision

1. **The feed is GitHub Releases on the public repository** (Q1). `electron-builder.yml` names it (`provider: github`, `nexustech/webforge`). So every build writes `app-update.yml` into the app, which electron-updater reads, and `latest.yml` (and `latest-mac.yml`) beside the installers, which a release lists.
   - electron-builder never uploads: every package script says `--publish never`.
   - The release workflow (5.2) uploads the installers and those files to a draft release, which goes out when it's published.
   - No token is in the app, and nothing else needs hosting.
2. **electron-updater, from the main process** (`main/updates.ts`):
   - it checks 10 seconds after the window opens, then every 6 hours, and downloads what it finds in the background;
   - once an update has downloaded, the checks stop, and the window shows a quiet notice: "Webforge 1.2.0 is ready: it installs when you close Webforge."
   - It installs as Webforge quits, as quitting's last step (`closeThenExit`'s `install`): once the site has closed and every feature has finished its last writes. electron-builder's installer ends a running Webforge, so nothing may still be writing. It doesn't install when quitting gave up waiting, or when the site failed to close.
   - The installer runs silently, and doesn't start Webforge again: the person chose to close it.
   - A failure is logged by its code only and never shown; the next check tries again.
   - electron-updater's own log is off, as it writes paths and addresses.
   - A check sends nothing about the person or their sites: it reads the feed and downloads the installer.
3. **Windows first; macOS with signing (0.5b).** Until then only a packaged Windows app updates itself (`updatesSupported`). On macOS a downloaded update couldn't install, so it isn't downloaded. 0.5b turns macOS on and gives `app-update.yml` the publisher, so electron-updater checks the Windows installer's signature too.
4. **Two channels, Beta and Stable, from GitHub's prerelease flag** (5.2, stream A). No version is marked `-beta`.
   - A release is published first as a prerelease, which Beta gets: electron-updater reads the newest release, prereleases included (`channel = "beta"`, `allowPrerelease`), and that release's `beta.yml`.
   - Promoted to latest, it reaches Stable: `channel = "latest"`, no prereleases, through GitHub's `releases/latest`. `tools/src/stage-rollout.ts` stages it through `latest.yml`'s `stagingPercentage` as it's promoted; Beta reads its own unstaged `beta.yml`.
   - **The default is Beta while the app's own version is below 1.0.0, and Stable from 1.0.0.** Until 1.0 every release is a prerelease, so Stable would find nothing.
   - A choice made in **Settings › App › Updates** always wins. Only an explicit choice is stored (`updateChannel` is optional in the preferences), so the default can change at 1.0 without moving anyone.
   - No downgrades: choosing a channel turns electron-updater's `allowDowngrade` on, so it's turned off again. Moving from Beta to Stable waits for Stable to catch up.
5. **Tested by updating an installed app** (`e2e/packaged/update.spec.ts`).
   - The test builds 0.0.1's and 0.0.2's installers from the e2e build, installs 0.0.1 silently into a folder of its own, and serves 0.0.2 on a local feed.
   - The installed 0.0.1 downloads 0.0.2 and shows the notice. Closed, it installs, and 0.0.2 starts.
   - The feed's address comes from `WEBFORGE_E2E_UPDATE_FEED`, read only by an e2e build (`--mode e2e`) and only for an address on this computer. A release build drops the code.
   - Installing registers Webforge for the current user, so the test runs only with `WEBFORGE_E2E_INSTALL=1`, which CI's Windows packaged job sets; it uninstalls at the end.

## Consequences

- **Releases are the feed:** a published release reaches every installed app on its channel within six hours, or at its next start. A release mustn't be published until it's been checked; a bad one is withdrawn by unpublishing it or promoting a fix.
- **GitHub is a dependency** of updating, as it already is of the source. Moving the feed to R2 later means changing `publish`. Installed apps read the feed their `app-update.yml` names, so they'd need one release that names the new place.
- **Mac users install new versions by hand until 0.5b.** The help page says so.
- **An unsigned Windows update installs without its signature being checked** until 0.5b sets `publisherName`. The download comes over HTTPS from GitHub, and its SHA-512 is checked against `latest.yml`.
- **CI's Windows packaged job takes a few minutes longer:** two installers are built for the update test.
