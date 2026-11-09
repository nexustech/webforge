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
   from the tag, and uploads them to the draft, with electron-updater's feed files (`latest.yml`,
   `latest-mac.yml`). The run's summary links to the draft. If a build fails, "Re-run failed
   jobs" builds it again and replaces what it had uploaded.
5. **Publish the draft** once its installers have been checked. Until then nobody gets the release:
   the app's updater doesn't see drafts.

The version is in the root `package.json` and `apps/desktop/package.json`, and release-please
changes both; About shows the app's. release-please writes `CHANGELOG.md` in its own style, so
Biome leaves that file alone (`biome.json`): don't format it by hand.

## A dry run

"Run workflow" on the Release workflow (`gh workflow run release.yml --ref <branch>`) builds the
branch on Windows and macOS as `<version>-dry-run.<run number>`, into a draft release of its own.
It's for checking the workflow and the installers: download them from the draft, then delete the
draft. A draft makes no tag, so nothing else is left behind. Only a dry run of `main` is signed:
another branch's code hasn't been reviewed, so its installers are always unsigned.

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

The workflow signs only a release or a dry run of `main`, but that check is in the workflow, which
a branch can change: anyone who can push could have a branch's dry run sign its own code. So 0.5b
keeps the signing secrets in a protected `release` environment, open only to `main` and the `v*`
tags and with a required reviewer, not in the repository's secrets, and the build job names that
environment.
