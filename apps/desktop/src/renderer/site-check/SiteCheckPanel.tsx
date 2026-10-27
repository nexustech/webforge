import { Button, cn, ScrollArea } from "@webforge/editor-ui";
import { isMessageKey, plural, t } from "@webforge/i18n";
import type { CheckLevel, CheckReport, Finding, RuleResult } from "@webforge/site-check";

/** A finding as the panel writes it: where it is, and anything else worth saying. */
export type DescribedFinding = { readonly place: string; readonly detail?: string | undefined };

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

/** One finding: where it is (click to jump), then its *Fix* and *Ignore*. */
function FindingRow({
  rule,
  finding,
  level,
  props,
}: {
  readonly rule: string;
  readonly finding: Finding;
  readonly level: CheckLevel;
  readonly props: SiteCheckPanelProps;
}) {
  const { place, detail } = props.describe(finding);
  const fix = props.fixFor(rule, finding);
  return (
    <li className="flex items-center gap-2 py-0.5 pl-5">
      <button
        type="button"
        className="min-w-0 truncate text-left hover:underline focus-visible:underline"
        aria-label={t("siteCheck.show.label", { item: place })}
        onClick={() => props.onJump(finding)}
      >
        {place}
      </button>
      {detail === undefined ? null : (
        <span className="shrink-0 text-muted-foreground">{detail}</span>
      )}
      <span className="ml-auto flex shrink-0 gap-1">
        {fix === undefined ? null : (
          <Button size="sm" variant="outline" onClick={fix}>
            {t("siteCheck.fix")}
          </Button>
        )}
        {level === "must" ? null : (
          <Button
            size="sm"
            variant="ghost"
            aria-label={t("siteCheck.ignore.label", { item: place })}
            onClick={() => props.onIgnore(rule, finding)}
          >
            {t("siteCheck.ignore")}
          </Button>
        )}
      </span>
    </li>
  );
}

/** One rule: its dot, name and one-line verdict (SP-13), then what it found. */
function RuleRow({
  result,
  props,
}: {
  readonly result: RuleResult;
  readonly props: SiteCheckPanelProps;
}) {
  const status = statusOf(result);
  const count = result.findings.length;
  const name = `siteCheck.rule.${result.rule}`;
  const verdict = count === 0 ? ruleText(`${name}.pass`) : ruleText(`${name}.fail`, count);
  return (
    <li data-rule={result.rule} data-status={status}>
      <div className="flex items-baseline gap-2">
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[status])} />
        <span className="sr-only">{t(`siteCheck.status.${status}`)}: </span>
        <span className="font-medium">{ruleText(name)}</span>
        <span className="text-muted-foreground">{verdict}</span>
      </div>
      {count === 0 ? null : (
        <ul>
          {result.findings.map((finding) => (
            <FindingRow
              key={finding.key}
              rule={result.rule}
              finding={finding}
              level={result.level}
              props={props}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * The Site Check panel (F-CHK-1, SP-13): a summary, then the rules under *Must fix*, *Should fix*
 * and *Tips*, each with a green, amber or red dot and its verdict, and what it found. A finding
 * jumps to where it is; some have a *Fix*; all but a *Must fix* can be ignored.
 */
export function SiteCheckPanel(props: SiteCheckPanelProps) {
  const { report, ignored, onRestore } = props;
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3 p-3 text-sm">
        <div className="flex items-center gap-2">
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
          const results = report.results.filter((result) => result.level === level);
          if (results.length === 0) return null;
          return (
            <section key={level} aria-labelledby={`site-check-${level}`}>
              <h3
                id={`site-check-${level}`}
                className="mb-1 text-xs font-semibold uppercase text-muted-foreground"
              >
                {t(`siteCheck.level.${level}`)}
              </h3>
              <ul className="flex flex-col gap-1">
                {results.map((result) => (
                  <RuleRow key={result.rule} result={result} props={props} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </ScrollArea>
  );
}
