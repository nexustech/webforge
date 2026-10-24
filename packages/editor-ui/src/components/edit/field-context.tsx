import { createContext, createElement, type ReactNode, useContext } from "react";
import type { FieldKind, FieldRenderer, FieldRendererProps, FieldRenderers } from "./field-spec.js";

const FieldRenderersContext = createContext<FieldRenderers>({});

/**
 * Gives the Edit panels inside it `renderers` (R11), over their built-in ones: the app's own for
 * the kinds it draws. Each panel has the set it is given, so two panels can have different ones.
 */
export function FieldRenderersProvider({
  renderers,
  children,
}: {
  readonly renderers: FieldRenderers;
  readonly children: ReactNode;
}) {
  return <FieldRenderersContext value={renderers}>{children}</FieldRenderersContext>;
}

/** The field renderers given to this part of the tree ({@link FieldRenderersProvider}). */
export function useFieldRenderers(): FieldRenderers {
  return useContext(FieldRenderersContext);
}

/** Draws a field of kind `kind` with its renderer in `renderers`; nothing if it has none. */
export function drawField<K extends FieldKind>(
  renderers: FieldRenderers,
  kind: K,
  props: FieldRendererProps<K>,
): ReactNode {
  const Renderer: FieldRenderer<K> | undefined = renderers[kind];
  return Renderer === undefined ? null : createElement(Renderer, props);
}
