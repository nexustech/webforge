import { Button, cn, ScrollArea } from "@webforge/editor-ui";
import { isMessageKey, plural, t } from "@webforge/i18n";
import type { CheckLevel, CheckReport, Finding, RuleResult } from "@webforge/site-check";
import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";

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
  /** Shows where the finding is. */
  readonly onJump: (finding: Finding) => void;
  readonly onIgnore: (rule: string, finding: Finding) => void;
  /** Brings back what was ignored. */
  readonly onRestore: () => void;
};

const LEVELS: readonly CheckLevel[] = ["must", "should", "tip"];

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

/** "2 must fix · 1 should fix · 3 tips", or the all-clear. */
function summary(report: CheckReport): string {
  const counts = LEVELS.map((level) =>
    report.results
      .filter((result) => result.level === level)
      .reduce((count, result) => count + result.findings.length, 0),
  );
  if (counts.every((count) => count === 0)) return t("siteCheck.allClear");
  return LEVELS.flatMap((level, index) => {
    const count = counts[index] ?? 0;
    return count === 0 ? [] : [plural(`siteCheck.count.${level}`, count)];
  }).join(" · ");
}

/**
 * One finding: where it is (click to jump), then its *Fix* and *Ignore*. A guide's (3.17) is a link
 * to its page on another website, and a one-time tip's *Ignore* is *Done*.
 */
function FindingRow({
  result,
  finding,
  props,
}: {
  readonly result: RuleResult;
  readonly finding: Finding;
  readonly props: SiteCheckPanelProps;
}) {
  const { rule, level } = result;
  const { place, detail } = props.describe(finding);
  const fix = props.fixFor(rule, finding);
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
        aria-label={guide ? undefined : t("siteCheck.show.label", { item: place })}
        onClick={() => props.onJump(finding)}
      >
        {place}
        {guide ? <ExternalLinkIcon aria-hidden className="size-3.5 shrink-0" /> : null}
      </button>
      {detail === undefined ? null : <span className="text-muted-foreground">{detail}</span>}
      <span className="ml-auto flex gap-1">
        {fix === undefined ? null : (
          <Button size="sm" variant="outline" onClick={fix}>
            {t("siteCheck.fix")}
          </Button>
        )}
        {level === "must" ? null : (
          <Button
            size="sm"
            variant="ghost"
            aria-label={t(done ? "siteCheck.done.label" : "siteCheck.ignore.label", {
              item: place,
            })}
            onClick={() => props.onIgnore(rule, finding)}
          >
            {t(done ? "siteCheck.done" : "siteCheck.ignore")}
          </Button>
        )}
      </span>
    </li>
  );
}

/**
 * One rule: its dot, name and one-line verdict (SP-13), then what it found. With `badge`, its
 * level too, as *Being found* mixes them.
 */
function RuleRow({
  result,
  props,
  badge = false,
}: {
  readonly result: RuleResult;
  readonly props: SiteCheckPanelProps;
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
        <span className="sr-only">{t(`siteCheck.status.${status}`)}: </span>
        <span className="font-medium">{ruleText(name)}</span>
        {badge ? (
          <span className="rounded border px-1 text-xs text-muted-foreground">
            {t(`siteCheck.badge.${result.level}`)}
          </span>
        ) : null}
        <span className="text-muted-foreground">{verdict}</span>
      </div>
      {count === 0 ? null : (
        <ul>
          {result.findings.map((finding) => (
            <FindingRow key={finding.key} result={result} finding={finding} props={props} />
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
 * The Site Check panel (F-CHK-1, SP-13): a summary, then the rules under *Must fix*, *Should fix*
 * and *Tips*, each with a green, amber or red dot and its verdict, and what it found, then *Being
 * found*'s (3.17), each with its level. A finding jumps to where it is; some have a *Fix*; all but
 * a *Must fix* can be ignored. A one-time tip is listed only while it has something to say.
 */
export function SiteCheckPanel(props: SiteCheckPanelProps) {
  const { report, ignored, onRestore } = props;
  const found = report.results.filter(
    (result) => result.group === "found" && (result.oneTime !== true || result.findings.length > 0),
  );
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
        {LEVELS.map((level) => {
          const results = report.results.filter(
            (result) => result.group === undefined && result.level === level,
          );
          if (results.length === 0) return null;
          return (
            <RuleSection
              key={level}
              id={`site-check-${level}`}
              title={t(`siteCheck.level.${level}`)}
            >
              {results.map((result) => (
                <RuleRow key={result.rule} result={result} props={props} />
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
              <RuleRow key={result.rule} result={result} props={props} badge />
            ))}
          </RuleSection>
        )}
      </div>
    </ScrollArea>
  );
}
