# Releasing

How a version of the desktop app gets from `main` to the people who use it (5.2, spec/03 §10). The
workflow is `.github/workflows/release.yml`; its header has the details.

## Making a release

1. **The release pull request.** After every merge to `main`, release-please updates a pull request
   titled `chore(main): release <version>`. It holds the next version and the CHANGELOG entries
   since the last release, both worked out from the merged pull requests' Conventional Commit
   titles:
   - `feat` raises the minor version and `fix` or `perf` the patch. Before 1.0, a breaking change
     (`feat!`) raises the minor version too.
   - Only `feat`, `fix`, `perf` and `revert` appear in the CHANGELOG.
   - To choose the version yourself (1.0, say), end a pull request's description with a
     `Release-As: 1.0.0` line: the description is its squash commit's message.
2. **Its CI.** GitHub doesn't run CI for a pull request a workflow opened with its own token. Close
   and reopen the release pull request to start it, unless the repository has a
   `RELEASE_PLEASE_TOKEN` secret (below).
3. **Merge it** when the release should go out. release-please tags the merge `v<version>` and
   makes a **draft** GitHub Release with the CHANGELOG entries.
4. **The builds.** The same workflow run builds the Windows installer and the macOS DMG and zip
   from the tag, and uploads them to the draft, with electron-updater's feed files: Stable's
   (`latest.yml`, `latest-mac.yml`) and Beta's (`beta.yml`, `beta-mac.yml`). The run's summary
   links to the draft. If a build fails, "Re-run failed jobs" builds it again and replaces what it
   had uploaded.
5. **Beta: publish the draft as a prerelease** once its installers have been checked ("Set as a
   pre-release"). Until then nobody gets the release: the app's updater doesn't see drafts.
6. **Stable, a share at a time.** Once it has gone well on Beta, move it to Stable for some of the
   people on it, then all of them:

   ```bash
   node tools/src/stage-rollout.ts v1.2.0 20
   node tools/src/stage-rollout.ts v1.2.0 100
   ```

   The first makes it the latest release, which Stable reads, offered to 20% of Stable's
   installations; the second offers it to everyone. Each installation keeps the same place in the
   share, so a larger share reaches the same people and more. Beta isn't affected.

## Channels

People choose theirs in Settings › App › Updates; Stable is the default.

- **Stable** gets the repository's latest release: one published as a prerelease isn't one yet.
- **Beta** gets the newest published release, prereleases included, so each release reaches it
  first, and every Stable release reaches it too.
- Moving from Beta to Stable never installs an older version: the app waits for a Stable release
  newer than the one it has.

The version is in the root `package.json` and `apps/desktop/package.json`, and release-please
changes both; About shows the app's.

## A dry run

"Run workflow" on the Release workflow (`gh workflow run release.yml --ref <branch>`) builds the
branch on Windows and macOS as `<version>-dry-run.<run number>`, into a draft release of its own.
It's for checking the workflow and the installers: download them from the draft, then delete the
draft. A draft makes no tag, so nothing else is left behind.

## Secrets

Each is optional. Without the signing secrets the installers are built unsigned, with a warning in
the run.

- `RELEASE_PLEASE_TOKEN`: a fine-grained token with contents and pull-request write access to
  this repository, so the release pull request's CI starts by itself.
- **macOS:**
  - `CSC_LINK` and `CSC_KEY_PASSWORD`: the Developer ID certificate (a base64 `.p12`) and its
    password;
  - `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`: notarisation.
- **Windows,** by the route Q3 chooses:
  - `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET`: Azure Artifact Signing;
  - `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`: a code-signing certificate.

Signing also needs electron-builder's signing options in `apps/desktop/electron-builder.yml`, which
0.5b (#850) adds with the secrets.
