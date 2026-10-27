import {
  altTextRule,
  brokenLinksRule,
  missingImagesRule,
  placeholdersRule,
} from "./rules/content.js";
import { contrastRule, underlinedTextRule } from "./rules/look.js";
import { largeFilesRule, largeImagesRule } from "./rules/media.js";
import { deviceNamesRule, homePageRule, pageTitlesRule, webAddressRule } from "./rules/pages.js";
import type {
  CheckInput,
  CheckLevel,
  CheckMode,
  CheckReport,
  CheckRule,
  RuleResult,
} from "./types.js";

/**
 * Site Check's rules (F-CHK-1, X5), in the panel's order within each level. Later items add
 * theirs here: forms with nowhere to send (3.7), external resources (3.9).
 */
export const SITE_CHECK_RULES: readonly CheckRule[] = [
  deviceNamesRule,
  homePageRule,
  brokenLinksRule,
  placeholdersRule,
  pageTitlesRule,
  webAddressRule,
  missingImagesRule,
  altTextRule,
  contrastRule,
  largeImagesRule,
  largeFilesRule,
  underlinedTextRule,
];

/** A rule's level in `mode`: publishing turns the publish-strict rules into *Must fix* (X5). */
export function levelIn(rule: CheckRule, mode: CheckMode): CheckLevel {
  return mode === "publish" && rule.strictOnPublish === true ? "must" : rule.level;
}

/**
 * The finding's key *Ignore* remembers: the rule's id and the finding's own key, so two rules'
 * findings at one place stay apart.
 */
export const ignoreKey = (rule: string, key: string): string => `${rule}:${key}`;

/**
 * Checks `input`'s site for `mode` with `rules` (F-CHK-1), leaving out what the person ignored
 * (`ignored`, {@link ignoreKey}s). Ignoring works for *Should fix* and *Tips* only: what is
 * *Must fix* in this mode is always listed, as it stops the export (X5).
 */
export function checkSite(
  input: CheckInput,
  mode: CheckMode,
  ignored: ReadonlySet<string> = new Set(),
  rules: readonly CheckRule[] = SITE_CHECK_RULES,
): CheckReport {
  const results = rules.map((rule): RuleResult => {
    const level = levelIn(rule, mode);
    const all = rule.check(input);
    const findings =
      level === "must"
        ? all
        : all.filter((finding) => !ignored.has(ignoreKey(rule.id, finding.key)));
    return { rule: rule.id, level, findings, ignored: all.length - findings.length };
  });
  return { mode, results };
}

/** How many findings in `report` are *Must fix*: what stops an export or publish (X5). */
export function blockingCount(report: CheckReport): number {
  return report.results
    .filter((result) => result.level === "must")
    .reduce((count, result) => count + result.findings.length, 0);
}
