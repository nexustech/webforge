import { cn, fieldControlClass } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { UNASKED_MINUTES } from "../../shared/ipc/mcp.js";

/** Props of {@link UnaskedChoice}. */
export type UnaskedChoiceProps = {
  /** The app, by the name the person gave it. */
  readonly name: string;
  /** When it stops working without asking on the open site, in ms; null while it asks. */
  readonly until: number | null;
  /** Lets it work without asking for `minutes`, or no longer (null). */
  readonly onChange: (minutes: number | null) => void;
  /** The time now, in ms: whether `until` has passed. */
  readonly now: number;
  readonly locale?: string;
};

/** What the choice keeps while the app works without asking, until it's changed. */
const ON = "on";
/** What it keeps while the app asks. */
const ASKS = "asks";

/** `at` as the person's computer writes a time of day ("15:45"). */
const timeOf = (at: number, locale?: string) =>
  new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(new Date(at));

/**
 * Whether an AI app works without asking on the open site (5.35, UA-2), in AI apps: *Ask first*,
 * as by default, or for a while. On, it says until when; choosing *Ask first* ends it at once.
 */
export function UnaskedChoice({ name, until, onChange, now, locale }: UnaskedChoiceProps) {
  const on = until !== null && until > now;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{t("aiApps.unasked.label")}</span>
      <select
        // Named with its app: each app's row has one (axe: a field's name is unique to it).
        aria-label={t("aiApps.unasked.for", { name })}
        value={on ? ON : ASKS}
        className={cn(fieldControlClass, "w-auto")}
        onChange={(event) => {
          const chosen = event.currentTarget.value;
          if (chosen === ON) return;
          onChange(chosen === ASKS ? null : Number(chosen));
        }}
      >
        <option value={ASKS}>{t("aiApps.unasked.asks")}</option>
        {on ? (
          <option value={ON}>{t("aiApps.unasked.until", { time: timeOf(until, locale) })}</option>
        ) : null}
        {UNASKED_MINUTES.map((minutes) => (
          <option key={minutes} value={minutes}>
            {minutes < 60
              ? t("aiApps.unasked.minutes", { count: minutes })
              : minutes === 60
                ? t("aiApps.unasked.hour")
                : t("aiApps.unasked.hours", { count: minutes / 60 })}
          </option>
        ))}
      </select>
    </label>
  );
}
