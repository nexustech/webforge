/**
 * A record's own keys and entries with its key type (#989, R10). `Object.keys` gives plain strings
 * to TypeScript, which would take a cast to a branded id (`PageId`) at every call. A record's own
 * keys are its keys, so the one cast is here. A site's records are parsed with their key schemas
 * when they're read, so their keys are well formed too.
 */
type AnyRecord<K extends string, V = unknown> = { readonly [key in K]?: V };

/** `record`'s own keys, typed as its keys. */
export const keysOf = <K extends string>(record: AnyRecord<K>): K[] => Object.keys(record) as K[];

/** `record`'s own entries, each key typed as its keys. */
export const entriesOf = <K extends string, V>(record: AnyRecord<K, V>): [K, V][] =>
  Object.entries(record) as [K, V][];

/**
 * Whether `key` is one of `record`'s own keys, as its key type: never a property every object has,
 * such as `constructor`, for a key read from a page, a file or an AI app.
 */
export const isKeyOf = <K extends string>(record: AnyRecord<K>, key: string): key is K =>
  Object.hasOwn(record, key);
