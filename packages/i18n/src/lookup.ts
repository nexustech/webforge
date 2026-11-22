/** A catalogue of messages by key. */
type Catalogue = Readonly<Record<string, string>>;

/** Values substituted into `{placeholder}`s of a message. */
type MessageParams = Readonly<Record<string, string | number>>;

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * `message` with its `{placeholder}`s replaced by `params`; one without a matching param is left
 * as is, so a missing value shows instead of silently disappearing.
 */
export function filled(message: string, params: MessageParams | undefined): string {
  if (params === undefined) {
    return message;
  }
  return message.replace(PLACEHOLDER, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/** The plural categories a count can fall in, as `Intl.PluralRules` names them. */
const CATEGORIES = ["zero", "one", "two", "few", "many", "other"] as const;

/** English's plural rules: "1 page", "2 pages". The catalogue is English (Q8). */
const RULES = new Intl.PluralRules("en");

/**
 * The lookups over `catalogue`, untyped: each entry point (`@webforge/i18n`, its `/components`
 * and its `/main`) declares them with its own catalogue's keys. `catalogue` holds `app.name`.
 */
export function lookups(catalogue: Catalogue) {
  // `{appName}` is the app's name, `app.name`: the one place the name is written (#450), so a
  // rename changes it there, and `productName` for the installers, and nothing else. `pnpm
  // ui-strings` refuses a message that spells the name out.
  const appName = catalogue["app.name"] ?? "";
  // A key the types allow is always there; the key itself, should one not be, shows where.
  const message = (key: string) => (catalogue[key] ?? key).replaceAll("{appName}", appName);
  const t = (key: string, params?: MessageParams) => filled(message(key), params);
  return {
    t,
    template: message,
    has: (key: string) => Object.hasOwn(catalogue, key),
    plural: (base: string, count: number, params?: MessageParams) => {
      const category = RULES.select(count);
      const key =
        CATEGORIES.includes(category) && Object.hasOwn(catalogue, `${base}.${category}`)
          ? `${base}.${category}`
          : `${base}.other`;
      return t(key, { ...(params ?? {}), count });
    },
  };
}
