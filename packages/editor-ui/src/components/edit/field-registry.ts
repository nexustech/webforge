import { type ComponentType, useSyncExternalStore } from "react";

/** What a field renderer needs to know about its field; the app maps its own definitions to this. */
export type FieldSpec = {
  /** The renderer to use, such as `text` or `select`. */
  readonly kind: string;
  /** Already translated. */
  readonly label: string;
  /** For `select`, `color`, `spacing` and `box`: the choices, labels already translated. */
  readonly options?: readonly { readonly label: string; readonly value: string }[];
  /** For `box`: the sides it sets, in order (top, right, bottom, left), labels translated. */
  readonly sides?: readonly { readonly label: string; readonly value: string }[];
  /** For `slider`: its steps, smallest first, labels already translated. */
  readonly steps?: readonly { readonly label: string; readonly value: string }[];
  /** For `text`: shown while the field is empty, already translated. */
  readonly placeholder?: string;
  /**
   * For `text`: why a value isn't acceptable (translated), or undefined if it is. The field then
   * reports its text only when the user is done with it, and only if it is acceptable.
   */
  readonly validate?: (value: string) => string | undefined;
  /** For `list`: what one item is called ("Testimonial"), already translated. */
  readonly itemLabel?: string;
  /** For `list`: the fields of each item. */
  readonly itemFields?: readonly ListItemFieldSpec[];
  /** For `list`: the order of the items means nothing (attributes), so they can't be moved. */
  readonly orderless?: boolean;
};

/** One field of a list item. */
export type ListItemFieldSpec = FieldSpec & { readonly name: string };

/** One item of a list's value: a key that stays with it when the list is reordered, its values. */
export type ListItemValue = {
  readonly key: string;
  readonly values: Readonly<Record<string, unknown>>;
};

/**
 * What a `list` renderer reports through `onChange` (F-ED-6): one change to the list, so the app
 * can record it as one labelled step ("Added Testimonial").
 */
export type ListChange =
  | { readonly type: "add" }
  | { readonly type: "move"; readonly key: string; readonly to: number }
  | { readonly type: "remove"; readonly key: string }
  | { readonly type: "edit"; readonly key: string; readonly name: string; readonly value: unknown };

/** Props every field renderer gets. */
export type FieldRendererProps = {
  /** Unique within the panel; the control's DOM id, so its label points at it. */
  readonly id: string;
  /** The label's DOM id, for controls a `<label for>` can't name (groups): `aria-labelledby`. */
  readonly labelId: string;
  readonly field: FieldSpec;
  readonly value: unknown;
  /**
   * The value changed. Called on every keystroke of a text field and every step of a slider drag,
   * once per choice elsewhere. A `list` reports a {@link ListChange} instead of the new value.
   */
  onChange(value: unknown): void;
  /**
   * The user is done with the field: it lost focus, a slider was let go, a choice was made. A run
   * of changes (typing, a drag) ends here.
   */
  onCommit(): void;
};

/** A field renderer: draws one field's control. */
export type FieldRenderer = ComponentType<FieldRendererProps>;

/** One registration of a renderer. */
type Registration = { readonly renderer: FieldRenderer };
/** Each kind's registrations, the latest last: it draws the kind's fields. */
const entries = new Map<string, readonly Registration[]>();
/**
 * The renderer drawing each kind: a new map on every change, so an Edit panel drawn before a
 * renderer was registered draws with it ({@link useFieldRenderers}), memoized or not.
 */
let renderers: ReadonlyMap<string, FieldRenderer> = new Map();
const listeners = new Set<() => void>();
const changed = () => {
  renderers = new Map(
    [...entries].flatMap(([kind, stack]) => {
      const top = stack.at(-1);
      return top === undefined ? [] : [[kind, top.renderer] as const];
    }),
  );
  for (const listener of listeners) listener();
};

/** Calls `listener` when a renderer is registered or removed; returns a function that stops. */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const current = () => renderers;

/** The registered renderers, by kind; a component using it redraws when they change. */
export function useFieldRenderers(): ReadonlyMap<string, FieldRenderer> {
  return useSyncExternalStore(subscribe, current, current);
}

/**
 * Makes `renderer` draw every field of `kind` in the Edit panel (1.14). Later registrations of a
 * kind replace earlier ones; the returned function takes this one away, and the latest of the
 * others still registered draws the kind again.
 */
export function registerFieldRenderer(kind: string, renderer: FieldRenderer): () => void {
  // An object of its own, so the same renderer registered twice is taken away once each time.
  const entry: Registration = { renderer };
  entries.set(kind, [...(entries.get(kind) ?? []), entry]);
  changed();
  return () => {
    const stack = entries.get(kind) ?? [];
    if (!stack.includes(entry)) return;
    const rest = stack.filter((each) => each !== entry);
    if (rest.length === 0) entries.delete(kind);
    else entries.set(kind, rest);
    changed();
  };
}

/** The renderer for `kind`, or undefined if none is registered (the field isn't shown). */
export function fieldRenderer(kind: string): FieldRenderer | undefined {
  return renderers.get(kind);
}
