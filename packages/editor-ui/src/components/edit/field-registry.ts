import type { ComponentType } from "react";

/** What a field renderer needs to know about its field; the app maps its own definitions to this. */
export type FieldSpec = {
  /** The renderer to use, such as `text` or `select`. */
  readonly kind: string;
  /** Already translated. */
  readonly label: string;
  /** For `select`: the choices, labels already translated. */
  readonly options?: readonly { readonly label: string; readonly value: string }[];
};

/** Props every field renderer gets. */
export type FieldRendererProps = {
  /** Unique within the panel; the control's DOM id, so its label points at it. */
  readonly id: string;
  readonly field: FieldSpec;
  readonly value: unknown;
  /** The value changed. Called on every keystroke of a text field, once per choice of a select. */
  onChange(value: unknown): void;
  /** The user is done with the field (it lost focus): a run of changes ends here. */
  onCommit(): void;
};

/** A field renderer: draws one field's control. */
export type FieldRenderer = ComponentType<FieldRendererProps>;

const renderers = new Map<string, FieldRenderer>();

/**
 * Makes `renderer` draw every field of `kind` in the Edit panel (1.14). Later registrations of a
 * kind replace earlier ones; the returned function puts the previous renderer back.
 */
export function registerFieldRenderer(kind: string, renderer: FieldRenderer): () => void {
  const previous = renderers.get(kind);
  renderers.set(kind, renderer);
  return () => {
    if (renderers.get(kind) !== renderer) {
      return;
    }
    if (previous === undefined) {
      renderers.delete(kind);
    } else {
      renderers.set(kind, previous);
    }
  };
}

/** The renderer for `kind`, or undefined if none is registered (the field isn't shown). */
export function fieldRenderer(kind: string): FieldRenderer | undefined {
  return renderers.get(kind);
}
