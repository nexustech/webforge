import { z } from "zod";

/**
 * An element or section on a page: its component type and its props (always with an `id`).
 * Slots (e.g. a Section's content) are arrays of nodes inside `props`.
 */
export type NodeDoc = {
  type: string;
  props: { id: string } & Record<string, unknown>;
};

/** One page's content tree. */
export type PageDoc = {
  root: { props: Record<string, unknown> };
  content: NodeDoc[];
};

/** The shared Header and Footer (C5), rendered on every page. */
export type LayoutDoc = {
  header: NodeDoc[];
  footer: NodeDoc[];
};

/** The site's theme: a daisyUI theme name until `@webforge/themes` defines curated themes. */
export type Theme = {
  readonly name: string;
};

const nodeDocSchema: z.ZodType<NodeDoc> = z.object({
  type: z.string().min(1),
  // Props are component-specific; slot arrays inside them are checked when the tree is walked.
  props: z.looseObject({ id: z.string().min(1) }),
});

/** Validates a {@link PageDoc} arriving from outside (IPC, files). */
export const pageDocSchema: z.ZodType<PageDoc> = z.object({
  root: z.object({ props: z.record(z.string(), z.unknown()) }),
  content: z.array(nodeDocSchema),
});

/** Validates a {@link LayoutDoc} arriving from outside (IPC, files). */
export const layoutDocSchema: z.ZodType<LayoutDoc> = z.object({
  header: z.array(nodeDocSchema),
  footer: z.array(nodeDocSchema),
});

/** Validates a {@link Theme}: a daisyUI-style theme name (lowercase letters, digits, hyphens). */
export const themeSchema: z.ZodType<Theme> = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
});

/** Whether `value` looks like a {@link NodeDoc}; used to find slot arrays inside props. */
export function isNodeDoc(value: unknown): value is NodeDoc {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { type, props } = value as { type?: unknown; props?: { id?: unknown } };
  return typeof type === "string" && typeof props?.id === "string";
}
