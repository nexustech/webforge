import type { Theme } from "@webforge/model";
import type { LookDraft } from "./studio-state.js";

/** A kind's look in `theme`: its fields, none when it has no look. */
const lookIn = (theme: Theme, type: string): Readonly<Record<string, unknown>> =>
  theme.looks?.[type] ?? {};

/**
 * What applying `draft` changes in `theme`'s look for its kind (4.10): each field that differs, to
 * its draft value, or `undefined` for one the draft takes off. Empty when the draft is the look.
 */
export function draftChange(theme: Theme, draft: LookDraft): Record<string, unknown> {
  const look = lookIn(theme, draft.type);
  const fields = new Set([...Object.keys(look), ...Object.keys(draft.look)]);
  return Object.fromEntries(
    [...fields]
      .filter((field) => JSON.stringify(look[field]) !== JSON.stringify(draft.look[field]))
      .map((field) => [field, draft.look[field]]),
  );
}

/** Whether `draft` would change `theme` once applied. */
export const draftChanges = (theme: Theme, draft: LookDraft | undefined): draft is LookDraft =>
  draft !== undefined && Object.keys(draftChange(theme, draft)).length > 0;

/**
 * `draft`, or a new one for `type` from the theme's look, with `change` made: each field to its
 * value, or taken off for `undefined`, as `setLook` would. `undefined` once it is the look again.
 */
export function changeDraft(
  theme: Theme,
  draft: LookDraft | undefined,
  type: string,
  item: string,
  change: Readonly<Record<string, unknown>>,
): LookDraft | undefined {
  const look: Record<string, unknown> = {
    ...(draft?.type === type ? draft.look : lookIn(theme, type)),
  };
  for (const [field, value] of Object.entries(change)) {
    if (value === undefined) delete look[field];
    else look[field] = structuredClone(value);
  }
  const next = { type, item, look };
  return draftChanges(theme, next) ? next : undefined;
}

/** `theme` with `draft` as its kind's look: what the previews draw while it isn't applied. */
export function themeWithDraft(theme: Theme, draft: LookDraft): Theme {
  const looks = { ...theme.looks };
  if (Object.keys(draft.look).length === 0) delete looks[draft.type];
  else looks[draft.type] = draft.look as NonNullable<Theme["looks"]>[string];
  const { looks: _, ...rest } = theme;
  return Object.keys(looks).length === 0 ? rest : { ...rest, looks };
}
