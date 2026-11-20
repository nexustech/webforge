import { Button } from "@webforge/editor-ui";
import { plural, t } from "@webforge/i18n";

/**
 * What Site Check still lists to fix, on the export's and Publish's reports (#1171): how many,
 * and a button that shows them. Nothing when it lists none.
 */
export function SiteCheckToFix({
  count,
  onShow,
}: {
  readonly count: number;
  readonly onShow: () => void;
}) {
  if (count === 0) return null;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <span>{plural("siteCheck.report.toFix", count)}</span>
      <Button variant="link" className="h-auto p-0" onClick={onShow}>
        {t("siteCheck.report.show")}
      </Button>
    </p>
  );
}
