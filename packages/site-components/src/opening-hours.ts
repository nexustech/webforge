import type { SiteText } from "@webforge/i18n";
import { DAYS, type Day, type OpeningHours } from "@webforge/model";

/** One line of a site's opening hours: when, and the hours then. */
export type OpeningHoursLine = {
  /** The days, read as a visitor says them: "Tuesday to Friday", "Saturday and Sunday". */
  readonly days: string;
  /** When it opens and closes, as stored (`HH:MM`): for `<time datetime>`. */
  readonly opens: string;
  readonly closes: string;
  /** The same, as the site's language writes a time: "9:00" in en-GB, "9:00 AM" in en-US. */
  readonly opensText: string;
  readonly closesText: string;
};

/**
 * `time` (`HH:MM`) as `language` writes a time of day, hour and minutes. As stored when there is
 * no language, or one the browser or Node doesn't know.
 */
export function timeText(time: string, language: string | undefined): string {
  const [hours, minutes] = time.split(":").map(Number);
  if (language === undefined || hours === undefined || minutes === undefined) return time;
  try {
    return new Intl.DateTimeFormat(language, { hour: "numeric", minute: "2-digit" }).format(
      new Date(2000, 0, 1, hours, minutes),
    );
  } catch {
    return time;
  }
}

/** `text` with its first letter a capital, as `language` writes one: "Lundi au vendredi". */
const capitalised = (text: string, language: string | undefined): string => {
  const first = text.codePointAt(0);
  if (first === undefined) return text;
  const letter = String.fromCodePoint(first);
  try {
    return letter.toLocaleUpperCase(language) + text.slice(letter.length);
  } catch {
    // A language the browser or Node doesn't know.
    return letter.toUpperCase() + text.slice(letter.length);
  }
};

/**
 * `days` as a visitor reads them, in the week's order and the site's language (`siteText`): three
 * or more days in a row as a range ("Tuesday to Friday"), others one by one, the last joined with
 * "and" ("Monday, Wednesday and Friday"). Its first letter is a capital, for a language whose day
 * names have none ("Lundi au vendredi").
 */
export function daysText(days: readonly Day[], siteText: SiteText, language?: string): string {
  const dayName = (day: Day) => siteText(`siteText.day.${day}`);
  const sorted = DAYS.filter((day) => days.includes(day));
  const runs: Day[][] = [];
  for (const day of sorted) {
    const run = runs.at(-1);
    const last = run?.at(-1);
    if (run !== undefined && last !== undefined && DAYS.indexOf(day) === DAYS.indexOf(last) + 1) {
      run.push(day);
    } else {
      runs.push([day]);
    }
  }
  const parts = runs.flatMap((run) => {
    const first = run[0];
    const last = run.at(-1);
    if (first === undefined || last === undefined) return [];
    return run.length >= 3
      ? [siteText("siteText.days.range", { from: dayName(first), to: dayName(last) })]
      : run.map(dayName);
  });
  const last = parts.pop();
  if (last === undefined) return "";
  return capitalised(
    parts.length === 0 ? last : siteText("siteText.days.and", { first: parts.join(", "), last }),
    language,
  );
}

/**
 * Site Settings' opening hours as the lines a page lists, in the order they were entered, their
 * days in the site's words (`siteText`) and their times written as `language` writes them.
 */
export function openingHoursLines(
  hours: readonly OpeningHours[],
  siteText: SiteText,
  language?: string,
): OpeningHoursLine[] {
  return hours.map((entry) => ({
    days: daysText(entry.days, siteText, language),
    opens: entry.opens,
    closes: entry.closes,
    opensText: timeText(entry.opens, language),
    closesText: timeText(entry.closes, language),
  }));
}
