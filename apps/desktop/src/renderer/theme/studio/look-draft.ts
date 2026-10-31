import type { Theme } from "@webforge/model";
import type { LookDraft } from "./studio-state.js";

/** A kind's look in `theme`: its fields, none when it has no look. */
const lookIn = (theme: Theme, type: string): Readonly<Record<string, unknown>> =>
  theme.looks?.[type] ?? {};

/** Whether the look's `field` is `value` already (`undefined`: it doesn't set the field). */
const holds = (look: Readonly<Record<string, unknown>>, field: string, value: unknown) =>
  JSON.stringify(look[field]) === JSON.stringify(value);

/**
 * What applying `draft` changes in `theme`'s look for its kind now (4.10): each field the draft
 * changes that the look doesn't already hold, to its value, or `undefined` for one the draft takes
 * off. Only the draft's own fields: a change made to the look since (an undo, another theme, *Style
 * this ‹kind›…*) stays. Empty when the draft would change nothing.
 */
export function draftChange(theme: Theme, draft: LookDraft): Record<string, unknown> {
  const look = lookIn(theme, draft.type);
  return Object.fromEntries(
    Object.entries(draft.change).filter(([field, value]) => !holds(look, field, value)),
  );
}

/** Whether `draft` would change `theme` once applied. */
export const draftChanges = (theme: Theme, draft: LookDraft | undefined): draft is LookDraft =>
  draft !== undefined && Object.keys(draftChange(theme, draft)).length > 0;

/**
 * `draft`, or a new one for `type`, with `change` made too: each field to its value, or taken off
 * for `undefined`, as `setLook` would. Only fields that differ from the theme's look now are kept;
 * `undefined` once none do.
 */
export function changeDraft(
  theme: Theme,
  draft: LookDraft | undefined,
  type: string,
  item: string,
  change: Readonly<Record<string, unknown>>,
): LookDraft | undefined {
  const merged: Record<string, unknown> = { ...(draft?.type === type ? draft.change : {}) };
  for (const [field, value] of Object.entries(change)) {
    merged[field] = value === undefined ? undefined : structuredClone(value);
  }
  const next = { type, item, change: merged };
  const kept = draftChange(theme, next);
  return Object.keys(kept).length === 0 ? undefined : { type, item, change: kept };
}

/** The kind's look as `draft` would make it: the theme's look now, with the draft's changes. */
export function draftLook(theme: Theme, draft: LookDraft): Record<string, unknown> {
  const look: Record<string, unknown> = { ...lookIn(theme, draft.type) };
  for (const [field, value] of Object.entries(draft.change)) {
    if (value === undefined) delete look[field];
    else look[field] = value;
  }
  return look;
}

/** `theme` with `draft` made to its kind's look: what the previews draw while it isn't applied. */
export function themeWithDraft(theme: Theme, draft: LookDraft): Theme {
  const look = draftLook(theme, draft);
  const looks = { ...theme.looks };
  if (Object.keys(look).length === 0) delete looks[draft.type];
  else looks[draft.type] = look as NonNullable<Theme["looks"]>[string];
  const { looks: _, ...rest } = theme;
  return Object.keys(looks).length === 0 ? rest : { ...rest, looks };
}
