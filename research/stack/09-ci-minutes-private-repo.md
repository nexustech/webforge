# CI minutes if the repository goes private again

**Status:** ℹ️ Research for a future decision (28 Oct 2026). Updated 31 Oct 2026: CI-2 is made, and CI-1 in a softer form (an hourly schedule); see §8. The rest is unchanged while the repository is public. The proposals are numbered CI-1…CI-6 so that a later decision can cite them.

**Question:** when nexustech/webforge goes private again, how can CI stay within GitHub Free's included Actions minutes, and in particular avoid the expensive macOS runners?

## 1. How GitHub bills Actions

- **Public repositories:** standard GitHub-hosted runners are free. That's why every ready PR runs on Linux, Windows and macOS today (`FULL_CI_ENABLED=true`, PR #283).
- **Private repositories on GitHub Free:** 2,000 included minutes a month.
  - Windows minutes count 2× against them and macOS minutes 10×.
  - GitHub's docs now give per-minute rates instead of multipliers: Linux 2-core $0.006, Windows 2-core $0.010, macOS $0.062. The ratio is still about 1 : 1.7 : 10.
  - Each job is rounded up to the next whole minute.
  - GitHub Pro raises the included minutes to 3,000.
- **Self-hosted runners:** use no included minutes. GitHub announced a $0.002-a-minute platform charge on self-hosted runners in private repositories for March 2026, then postponed it within days. As of mid-2026 it hasn't taken effect, but it may come back in another form.

## 2. What CI used (25 Oct 10:55 → 28 Oct 10:25 UTC)

The figures come from every job of the last 1,000 workflow runs, the most the runs API returns for a date filter. That covers about three days. Collected with `gh api`; the scripts are listed in §7.

**Activity in that window**
- 113 PRs merged, from three stream sessions.
- 333 CI runs on PRs, 242 of them on all three operating systems, plus 4 scheduled or manual runs.
- 663 merge-queue runs.

**Minutes used, each job rounded up**

| | Minutes | Counted against the free minutes |
|---|---|---|
| Linux | 8,084 | 8,084 |
| Windows | 6,281 | 12,562 |
| macOS | 6,295 | **62,950 (75%)** |
| **Total** | | **83,596** |

**Per day:** about 26,000 counted minutes on a full working day (26 and 27 Oct), against 2,000 for a whole month. At this pace a private repository would use the month's allowance in under two hours.

**One full run on all three operating systems**
- About 29 Linux, 25.5 Windows and 25.5 macOS minutes.
- That counts **336 minutes**, of which 255 are macOS. The free allowance covers about **six full runs a month**.

**Where the time goes, by job**

| Job | Minutes | Runs | Average |
|---|---|---|---|
| E2E, macOS (2 shards) | 4,267 | 510 | 8.4 |
| E2E, Windows (2 shards) | 3,763 | 510 | 7.4 |
| Storybook, Linux | 2,711 | 219 | 12.4 |
| E2E, Linux | 2,331 | 255 | 9.1 |
| Check, Windows | 1,932 | 261 | 7.4 |
| Check, macOS | 1,483 | 261 | 5.7 |
| Check, Linux | 1,356 | 261 | 5.2 |
| Merge queue | 663 | 663 | 1.0 |
| Packaged app, Windows / macOS | 586 / 545 | 261 each | 2.2 / 2.1 |
| CI passed, Changes, Exported site, Audit | about 1,000 together | | about 1 each |

**Waste**
- **Cancelled jobs:** 2,237 minutes, about 11%. Superseded pushes, and queue updates that arrive while a run is in flight.
- **Failed jobs:** 934 minutes, about 5%.
- **Re-runs:** 99 run attempts.
- **Re-runs after merges:** because `main` requires PRs to be up to date, and the merge queue brings each waiting PR up to date in turn, every merge re-runs the PRs behind it. That came to about **2.1 full runs per merged PR**.
- **The merge queue's own runs:** 663 runs in three days, each billed at least a minute (every 15 minutes, after every CI run, and on every push and auto-merge). That's about **6,600 minutes a month on its own**, more than the whole allowance.

**What it would cost if billed:** at GitHub's rates, the three days come to about $500. That's roughly **$5,000 a month** at this pace, about $3,900 of it macOS.

## 3. What that means

1. **While three streams are working, no GitHub-hosted set-up fits in 2,000 minutes.** Even Linux alone runs at about 2,700 counted minutes a day.
2. **macOS is three quarters of the cost.** It's the first thing to move off pull requests.
3. **Some of the cost is the workflow itself, not the testing:** the merge queue's schedule, re-runs after every merge, repeated unit tests on Windows and macOS, and per-job rounding. These cuts help in every option.

## 4. Options

### Cuts that help in every option

- **CI-1. Remove the merge queue's 15-minute schedule.** Merges, CI results and auto-merge already trigger it. That saves about 200 runs and 200 minutes in three days. Skipping its `workflow_run` runs when no PR is waiting would save more.
- **CI-2. Windows and macOS "Check" runs only what differs by OS:** the licence check of each OS's native packages, plus any OS-specific tests. Unit tests already run on Linux. That saves about 13 minutes on two operating systems in every run.
- **CI-3. macOS off pull requests.**
  - It runs on a schedule (weekly, or nightly on `main` only if `main` changed), on a manual "Run workflow", and on a PR that asks for it with a `full-ci` label.
  - Use the label for PRs that touch packaging, native modules, the window or macOS-specific code.
- **CI-4. Fewer re-runs after merges.**
  - Either stop requiring branches to be up to date, and check `main` nightly instead;
  - or keep the requirement but let the queue update a PR only once it is next to merge, as it nearly does now.
  - This trades some safety for about half of today's runs.

### When the repository goes private: three set-ups

**A. A self-hosted runner on the developer's PC, plus macOS once a week (CI-5)**
- **Linux jobs** run in Docker on the Windows PC (Docker Desktop is already used for `pnpm visual:docker`). **Windows jobs** run natively on the same PC.
- **macOS** runs once a week, either on GitHub's macOS runner or on one AWS Mac held for its 24-hour minimum (see below).
- **Cost:**
  - Linux and Windows: no GitHub minutes, as long as the self-hosted charge stays postponed.
  - macOS weekly: one full macOS pass is about 25 minutes, which counts 255 a week (about 1,100 a month) on GitHub; or about $21 a week (about $90 a month) for an AWS Mac.
- **Catches:**
  - The PC must be on for PRs to check, and the three streams' runs queue behind one runner per OS. More runner processes help only as far as the PC's cores and the E2E display allow.
  - Workflows need runner labels and must work on both runner kinds.
  - Security is acceptable for a private repository with collaborators only. A self-hosted runner must never serve a public repository's fork PRs.

**B. Scheduled CI only (CI-6)**
- Each PR is checked by the local `pnpm check` and `pnpm e2e` (and `pnpm visual:docker` when stories change), which streams already run before marking a PR ready.
- CI on a PR is one small Linux job (`changes` plus static checks, about 5–7 minutes), or nothing, with "CI passed" not required.
- **Schedule:**
  - Linux full: nightly, only if `main` changed. About 29 minutes; at 22 working nights a month, about 640.
  - Windows full: twice a week. About 25 minutes each, counting 51; about 440 a month.
  - macOS full: weekly. About 255 counted; about 1,100 a month.
- **Cost:** about 2,180 counted minutes a month, just over the free allowance. Fitting inside it means cutting something, for example Linux only on weekdays or Windows once a week; GitHub Pro's 3,000 minutes would cover it.
- **Catches:** a PR on a small Linux gate can't keep its own CI under the allowance at today's pace (about 38 PRs a day). Bugs specific to Windows and macOS are found on `main` a day or a week after they land, not before the merge.

**C. AWS-hosted self-hosted runners for all three operating systems**

| | How it's billed | Rate (us-east-1, on demand) |
|---|---|---|
| Linux | A machine per job (c7i.xlarge, 4 vCPU, 8 GB), by the second | ~$0.18/h; ~$0.06/h on spot |
| Windows | The same machine with AWS's Windows licence ($0.046 per vCPU-hour) | ~$0.36/h |
| macOS | A dedicated Mac mini (mac2-m2.metal), held for at least 24 hours | ~$0.88/h (~$21/day each) |

- **Measured job time:** about 36 Linux, 32 Windows and 32 macOS job-hours a day. Add 15–20% for start-up on Linux and Windows.
- **Macs:** one gives at most 24 job-hours a day, and each run starts four macOS jobs at once. So it needs at least two Macs, and three or four to avoid queueing.

**Estimated cost at today's pace**

| | Per day | Per month |
|---|---|---|
| Linux, on demand (spot) | ~$7.50 (~$2.50) | ~$220 (~$75) |
| Windows, on demand | ~$14 | ~$425 |
| macOS, 2 Macs | ~$42 | ~$1,280 |
| macOS, 4 Macs | ~$84 | ~$2,560 |
| Storage and data transfer | ~$1–2 | ~$30–60 |
| **Total with 2 Macs** | **~$65** | **~$1,950** |
| **Total with 4 Macs** | **~$107** | **~$3,250** |

- **Discounts:** a 1-year Compute Savings Plan takes about 30% off Linux and Windows.
- **Cheaper variant:** Linux and Windows on demand, with macOS weekly on one Mac, comes to about $350–750 a month.
- **Not counted:** setting it up and keeping it running.
  - A scaler is needed to start and stop the machines: the open-source Philips `terraform-aws-github-runner`, or a paid service such as runs-on.
  - Mac images need maintaining (Xcode command-line tools, Node, Playwright).
  - Keeping runners on public subnets avoids a NAT gateway (about $32 a month plus data).

## 5. Comparison

| Set-up | GitHub minutes a month | Cash a month (today's pace) | macOS found | Maintenance |
|---|---|---|---|---|
| Stay public (today) | 0 | $0 | Before merge | None |
| Private, as today, billed | ~800,000 counted | ~$5,000 | Before merge | None |
| A. PC runner + macOS weekly | ~1,100 (GitHub Mac) or 0 | $0, or ~$90 for an AWS Mac | Within a week | PC on; one runner per OS |
| B. Scheduled only | ~2,200 | $0–4 (Pro) | Within a week | Low; later feedback |
| C. AWS for all three | 0 | ~$1,950–3,250 | Before merge | Scaler, images, AWS account |

The cuts in §4 (CI-1…CI-4) lower every row: by an estimated 30–50% in A and C, and they're what makes B possible.

## 6. Recommendation (for the decision later)

1. **Stay public while three streams are working.** It costs nothing and keeps all three operating systems on every PR.
2. **Before going private,** make the cuts that help in every option:
   - CI-1 (no merge-queue schedule) and CI-2 (no repeated unit tests on Windows and macOS) are worth doing even while public, since they make runs shorter;
   - CI-3 (macOS on a schedule or a label) is the change that matters most once minutes are billed.
3. **When going private:** option **A**, a self-hosted runner on the PC for Linux and Windows, with macOS weekly on one AWS Mac (about $90 a month) or GitHub's runner. Fall back to option B when the PC can't be relied on to be on.
4. **Revisit:** if GitHub brings back a self-hosted charge, or if the pace drops to a few PRs a day. At about five PRs a working day, Linux-only CI on PRs (about 7 minutes each) plus weekly macOS fits in GitHub Pro's 3,000 minutes.

Current settings to remember: `FULL_CI_ENABLED` turns Windows and macOS off when unset. `.github/workflows/ci.yml`'s header lists every switch, and `merge-queue.yml` holds the queue's triggers.

## 7. Method and sources

- **Data:** `gh api repos/nexustech/webforge/actions/runs` filtered `created>=2026-10-22`, which the API cuts off at 1,000 runs, so it reaches back to 25 Oct 10:55 UTC. Then every job of each run, with `filter=all` to include re-run attempts.
  - Each job's minutes are its completion time minus its start time, rounded up to the next minute.
  - The OS comes from the runner labels.
  - The weights are 1 / 2 / 10.
- **Scripts:** `ci_usage.py` (collection) and `ci_analyse.py` (summary), kept outside the repository with the raw `ci_runs.json`. They can be re-run for a fresh window.
- **Merged PRs:** `gh pr list --state merged --search "merged:2026-10-25T10:55:00Z..2026-10-28T10:25:00Z"`.
- **Pricing (checked 28 Oct 2026):**
  - [How use of GitHub Actions is measured](https://docs.github.com/en/billing/concepts/product-billing/github-actions) (GitHub Docs)
  - [GitHub Actions pricing changes 2026](https://cicdcost.com/github-actions-pricing-changes-2026) (cicdcost.com)
  - [GitHub walks back plan to charge for self-hosted runners](https://www.theregister.com/2025/12/17/github_charge_dev_own_hardware/) (The Register)
  - [GitHub delays paid self-hosting of runners](https://www.techzine.eu/news/devops/137396/github-bends-to-criticism-and-delays-paid-self-hosting-of-runners/) (Techzine)
  - [Self-hosted runner fee 2026](https://runs-on.com/blog/github-self-hosted-runner-fee-2026/) (runs-on)
  - [EC2 Mac pricing from the AWS Pricing API](https://dev.classmethod.jp/en/articles/ec2-mac-m3ultra-metal-pricing-api/) (Classmethod)
  - [mac2-m2.metal](https://instances.vantage.sh/aws/ec2/mac2-m2.metal) (Vantage)
  - [c7i.xlarge in us-east-1](https://www.doit.com/compute/spot/us-east-1/c7i.xlarge) (DoiT)
  - [c7i.xlarge in us-east-1](https://calculator.holori.com/aws/ec2/c7i.xlarge/us-east-1) (Holori)
  - [EC2 Mac instances](https://aws.amazon.com/blogs/aws/use-amazon-ec2-m1-mac-instances-to-build-test-macos-ios-ipados-tvos-and-watchos-apps/) (AWS News Blog)
  - The AWS figures come from third-party trackers of the AWS Pricing API. Confirm them on AWS's own pricing pages before budgeting.

## 8. Update, 31 Oct 2026: CI-1 and CI-2 made, and the longest jobs sharded

**Measured again, 28 Oct 10:53 → 31 Oct 07:25 UTC** (the same scripts): 126 CI runs, 440 merge-queue runs and 45 merged PRs, quieter after 28 Oct with Phase 3's end and the Phase 4 pause.
- **Minutes:** 3,988 Linux, 3,239 Windows and 3,272 macOS, so 43,186 counted if billed, 76% of it macOS.
- **Runs per PR:** 2.0 full runs per merged PR, about as before.
- **Waste:**
  - cancelled jobs 13% of the counted minutes, failed jobs 3%;
  - 40 of the 126 runs were run again (34 twice, 6 three times).
- **Merge queue:** the 15-minute schedule made 256 of the 440 runs.

**Failures.** 20 runs failed. The flaky tests behind most of the re-runs are tracked as issues:
- `theme-not-changed.spec.ts` (macOS, Linux and the nightly run on `main`);
- `image.spec.ts` (macOS);
- timing limits that slow runners miss: `check-cost.test.ts` on Windows, and opening budgets on macOS;
- four one-off Windows E2E failures.

The real failures, caused by the PR itself, were sometimes run again unchanged, which wastes a run.

**Job times:**

| Job | Average (min) |
|---|---|
| Storybook | 17.4 |
| E2E, Linux, one shard | 11.5 |
| E2E, macOS, per shard | 10.7 |
| E2E, Windows, per shard | 9.5 |
| Check, Windows | 9.2 |
| Check, macOS | 7.4 |
| Check, Linux | 6.6 |

On Windows and macOS, `Check` was the unit tests twice (`pnpm test`, then `pnpm test:compiled`) plus a 3-second licence check.

**Done (PR "ci: unit tests on Linux for PRs, an hourly queue safety net, and two shards for Storybook and Linux E2E"):**
- **CI-2:** Windows' and macOS' unit tests run nightly and in "Run workflow" runs, not on PRs. Their licence check moved into the packaged-app job. That's about 17 fewer minutes per full run, about 92 of the ~410 it would count if billed.
- **CI-1, softened:** the merge queue's schedule runs hourly rather than every 15 minutes. It stays as a safety net because the `auto_merge_enabled` trigger has been missed before.
- **Sharding, for run length rather than minutes:** Storybook and Linux's E2E run in two shards each, so neither of the two longest jobs holds up a PR as long. Shorter runs also mean fewer PRs are in flight when another merges.
- **What it costs:** a bug in the unit tests that shows only on Windows or macOS is found by the nightly run on `main`, not before the merge (for example the macOS storage torn-copy test, #295, and a Windows timing test).
