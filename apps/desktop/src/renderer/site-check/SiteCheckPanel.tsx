import { Button, cn, ScrollArea } from "@webforge/editor-ui";
import { isMessageKey, plural, t } from "@webforge/i18n";
import type { CheckReport, Finding, RuleResult } from "@webforge/site-check";
import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { HelpButton, type HelpTopic } from "../help/index.js";
import { countsByLevel, LEVELS } from "./counts.js";

/** A finding as the panel writes it: where it is, and anything else worth saying. */
type DescribedFinding = { readonly place: string; readonly detail?: string | undefined };

/** What the panel shows and does. */
export type SiteCheckPanelProps = {
  readonly report: CheckReport;
  /** How many findings the person ignored. */
  readonly ignored: number;
  readonly describe: (finding: Finding) => DescribedFinding;
  /** The finding's *Fix*, if it has one. */
  readonly fixFor: (rule: string, finding: Finding) => (() => void) | undefined;
  /** The assistant's *Write One…* for the finding, while it's on and can (#873). */
  readonly writeFor?: (rule: string, finding: Finding) => (() => void) | undefined;
  /** Shows where the finding is. */
  readonly onJump: (finding: Finding) => void;
  readonly onIgnore: (rule: string, finding: Finding) => void;
  /** Brings back what was ignored. */
  readonly onRestore: () => void;
};

/** A rule's dot (SP-13): green when it passes, red for a Must fix, amber otherwise. */
type Status = "pass" | "warn" | "fail";

const statusOf = (result: RuleResult): Status =>
  result.findings.length === 0 ? "pass" : result.level === "must" ? "fail" : "warn";

const DOT: Readonly<Record<Status, string>> = {
  pass: "bg-success",
  warn: "bg-warning",
  fail: "bg-destructive",
};

/**
 * A rule's text, `siteCheck.rule.<id>` and its `.pass` and `.fail` verdicts: `count`'s `.one` or
 * `.other` for a verdict that counts. The rule's own key when the catalogue has none for it.
 */
function ruleText(key: string, count?: number): string {
  const counted = count === undefined ? key : `${key}.${count === 1 ? "one" : "other"}`;
  return isMessageKey(counted) ? t(counted, count === undefined ? undefined : { count }) : key;
}

/** The section of the Site Check help page that explains `result`'s rule (5.4b). */
function helpTopicOf(result: RuleResult): HelpTopic {
  if (result.group === "found") return "siteCheck.found";
  return result.level === "must"
    ? "siteCheck.must"
    : result.level === "should"
      ? "siteCheck.should"
      : "siteCheck.tip";
}

/** "2 must fix · 1 should fix · 3 tips", or the all-clear. */
function summary(report: CheckReport): string {
  const counts = countsByLevel(report);
  if (LEVELS.every((level) => counts[level] === 0)) return t("siteCheck.allClear");
  return LEVELS.flatMap((level) =>
    counts[level] === 0 ? [] : [plural(`siteCheck.count.${level}`, counts[level])],
  ).join(" · ");
}

/**
 * One finding: where it is (click to jump), then its *Fix* and *Ignore*. A guide's (3.17) is a link
 * to its page on another website, and a one-time tip's *Ignore* is *Done*.
 */
function FindingRow({
  result,
  finding,
  item,
  props,
}: {
  readonly result: RuleResult;
  readonly finding: Finding;
  /** What its buttons call it: its place, told apart from the panel's others' ({@link namesOf}). */
  readonly item: string;
  readonly props: SiteCheckPanelProps;
}) {
  const { rule, level } = result;
  const { place, detail } = props.describe(finding);
  const fix = props.fixFor(rule, finding);
  const write = props.writeFor?.(rule, finding);
  const guide = finding.place.kind === "guide";
  const done = result.oneTime === true;
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-0.5 pl-4">
      <button
        type="button"
        className={cn(
          "text-left [overflow-wrap:anywhere] hover:underline focus-visible:underline",
          guide && "inline-flex items-center gap-1 underline underline-offset-2",
        )}
        aria-label={guide ? undefined : t("siteCheck.show.label", { item })}
        onClick={() => props.onJump(finding)}
      >
        {place}
        {guide ? <ExternalLinkIcon aria-hidden className="size-3.5 shrink-0" /> : null}
      </button>
      {detail === undefined ? null : <span className="text-muted-foreground">{detail}</span>}
      <span className="ml-auto flex gap-1">
        {fix === undefined ? null : (
          // Named for what it fixes, as Ignore is: seven buttons all named "Fix" told a screen
          // reader nothing (WCAG 2.4.6, #1164).
          <Button
            size="sm"
            variant="outline"
            aria-label={t("siteCheck.fix.label", { item })}
            onClick={fix}
          >
            {t("siteCheck.fix")}
          </Button>
        )}
        {write === undefined ? null : (
          <Button
            size="sm"
            variant="outline"
            aria-label={t("siteCheck.write.label", { item })}
            onClick={write}
          >
            {t("siteCheck.write")}
          </Button>
        )}
        {level === "must" ? null : (
          <Button
            size="sm"
            variant="ghost"
            aria-label={t(done ? "siteCheck.done.label" : "siteCheck.ignore.label", { item })}
            onClick={() => props.onIgnore(rule, finding)}
          >
            {t(done ? "siteCheck.done" : "siteCheck.ignore")}
          </Button>
        )}
      </span>
    </li>
  );
}

/** A finding's key in the panel: its rule's and its own, which is its rule's alone. */
const findingKey = (rule: string, finding: Finding) => `${rule}:${finding.key}`;

/**
 * What each finding in `results` is called on its buttons ("Fix: Contact form on About"), by
 * {@link findingKey}: its place, with its rule's name where another finding has the same place, and
 * a number after that where that isn't enough, so no two buttons share a name (WCAG 2.4.6, #1164).
 * Two Contact forms on one page, or a page missing its title and its description, had two buttons
 * each named "Fix: About". The finding's own text is its place alone.
 */
function namesOf(
  results: readonly RuleResult[],
  describe: SiteCheckPanelProps["describe"],
): ReadonlyMap<string, string> {
  const listed = results.flatMap((result) =>
    result.findings.map((finding) => ({
      key: findingKey(result.rule, finding),
      place: describe(finding).place,
      rule: ruleText(`siteCheck.rule.${result.rule}`),
    })),
  );
  const counted = (names: readonly string[]) => {
    const counts = new Map<string, number>();
    for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
    return counts;
  };
  const places = counted(listed.map((each) => each.place));
  const named = listed.map((each) => ({
    key: each.key,
    name:
      (places.get(each.place) ?? 0) > 1
        ? t("siteCheck.item.inRule", { item: each.place, rule: each.rule })
        : each.place,
  }));
  const repeated = counted(named.map((each) => each.name));
  const seen = new Map<string, number>();
  return new Map(
    named.map(({ key, name }) => {
      if ((repeated.get(name) ?? 0) < 2) return [key, name];
      const n = (seen.get(name) ?? 0) + 1;
      seen.set(name, n);
      return [key, t("siteCheck.item.nth", { item: name, n })];
    }),
  );
}

/**
 * One rule: its dot, name and one-line verdict (SP-13), then what it found. With `badge`, its
 * level too, as *Being found* mixes them.
 */
function RuleRow({
  result,
  props,
  names,
  badge = false,
}: {
  readonly result: RuleResult;
  readonly props: SiteCheckPanelProps;
  /** What each finding's buttons call it, by {@link findingKey} ({@link namesOf}). */
  readonly names: ReadonlyMap<string, string>;
  readonly badge?: boolean;
}) {
  const status = statusOf(result);
  const count = result.findings.length;
  const name = `siteCheck.rule.${result.rule}`;
  const verdict = count === 0 ? ruleText(`${name}.pass`) : ruleText(`${name}.fail`, count);
  return (
    <li data-rule={result.rule} data-status={status}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span aria-hidden className={cn("size-2 shrink-0 self-center rounded-full", DOT[status])} />
        {/* The level's own words, as its heading and the summary say them (#1164). */}
        <span className="sr-only">
          {status === "pass" ? t("siteCheck.status.pass") : t(`siteCheck.badge.${result.level}`)}:{" "}
        </span>
        <span className="font-medium">{ruleText(name)}</span>
        {badge ? (
          <span className="rounded border px-1 text-xs text-muted-foreground">
            {t(`siteCheck.badge.${result.level}`)}
          </span>
        ) : null}
        <span className="text-muted-foreground">{verdict}</span>
        <HelpButton
          topic={helpTopicOf(result)}
          about={ruleText(name)}
          className="ml-auto size-5 self-center"
        />
      </div>
      {count === 0 ? null : (
        <ul>
          {result.findings.map((finding) => (
            <FindingRow
              key={finding.key}
              result={result}
              finding={finding}
              item={names.get(findingKey(result.rule, finding)) ?? props.describe(finding).place}
              props={props}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** A section of the panel: its heading, maybe a line under it, then its rules. */
function RuleSection({
  id,
  title,
  intro,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly intro?: string;
  readonly children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
        {title}
      </h3>
      {intro === undefined ? null : <p className="mb-1 text-muted-foreground">{intro}</p>}
      <ul className="flex flex-col gap-1">{children}</ul>
    </section>
  );
}

/**
 * The Site Check panel (F-CHK-1, SP-13): a summary, then what it found, under *Must fix*, *Should
 * fix* and *Tips*, each rule with an amber or red dot, its verdict and its findings, then *Being
 * found*'s (3.17), each with its level; then every rule that passed, in one *Passed* group at the
 * end, folded until opened, so no passed rule sits among the problems (#1164). A finding jumps to
 * where it is; some have a *Fix*; all but a *Must fix* can be ignored. A one-time tip is listed only
 * while it has something to say.
 */
export function SiteCheckPanel(props: SiteCheckPanelProps) {
  const { report, ignored, onRestore } = props;
  const problem = (result: RuleResult) => result.findings.length > 0;
  const found = report.results.filter((result) => result.group === "found" && problem(result));
  const passed = report.results.filter((result) => !problem(result) && result.oneTime !== true);
  const levels = LEVELS.map((level) => ({
    level,
    results: report.results.filter(
      (result) => result.group === undefined && result.level === level && problem(result),
    ),
  }));
  const names = namesOf([...levels.flatMap((each) => each.results), ...found], props.describe);
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className="font-medium">
            {summary(report)}
          </p>
          {ignored === 0 ? null : (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={onRestore}>
              {plural("siteCheck.restore", ignored)}
            </Button>
          )}
        </div>
        {levels.map(({ level, results }) => {
          if (results.length === 0) return null;
          return (
            <RuleSection
              key={level}
              id={`site-check-${level}`}
              title={t(`siteCheck.level.${level}`)}
            >
              {results.map((result) => (
                <RuleRow key={result.rule} result={result} props={props} names={names} />
              ))}
            </RuleSection>
          );
        })}
        {found.length === 0 ? null : (
          <RuleSection
            id="site-check-found"
            title={t("siteCheck.group.found")}
            intro={t("siteCheck.group.found.intro")}
          >
            {found.map((result) => (
              <RuleRow key={result.rule} result={result} props={props} names={names} badge />
            ))}
          </RuleSection>
        )}
        {passed.length === 0 ? null : (
          // Folded until opened: #1164's recommended default, which the plan takes.
          <details>
            <summary className="mb-1 cursor-pointer text-xs font-semibold uppercase text-muted-foreground">
              {t("siteCheck.passed", { count: passed.length })}
            </summary>
            <ul className="flex flex-col gap-1">
              {passed.map((result) => (
                <RuleRow
                  key={result.rule}
                  result={result}
                  props={props}
                  names={names}
                  badge={result.group === "found"}
                />
              ))}
            </ul>
          </details>
        )}
      </div>
    </ScrollArea>
  );
}
