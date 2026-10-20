import { z } from "zod";
import { anchorIdSchema } from "./link.js";

/**
 * Advanced-mode options of a node (F-ED-11): extra CSS classes, HTML attributes and the anchor that
 * section links point at.
 */
export type NodeAdvanced = {
  /** Space-separated class names, added after the component's own. */
  className?: string | undefined;
  attributes?: Record<string, string> | undefined;
  anchorId?: string | undefined;
};

/**
 * An element or section on a page: its component type and its props (always with an `id`).
 * Slots (e.g. a Section's content) are arrays of nodes inside `props`. `id`, `layerName`, `hidden`
 * and `advanced` are reserved for Webforge; components never use them as field names.
 */
export type NodeDoc = {
  type: string;
  props: {
    id: string;
    /**
     * The name the user gave it in Layers, used in undo labels ("Edited 'Opening times' text").
     * Not `label`, which components use for their own fields (a Button's label).
     */
    layerName?: string | undefined;
    /** Hidden in Layers: shown dimmed on the canvas and left out of the export (F-ED-12). */
    hidden?: boolean | undefined;
    advanced?: NodeAdvanced | undefined;
  } & Record<string, unknown>;
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

/**
 * Attribute names Advanced mode accepts: `data-*`, `aria-*` and a few harmless global attributes.
 * An allow-list, so nothing can add event handlers, inline styles or `javascript:` URLs.
 */
const attributeNameSchema = z
  .string()
  .regex(/^(?:data-[a-z0-9-]+|aria-[a-z]+|role|title|lang|dir|translate|tabindex)$/);

const CLASS_NAMES = /^(?:[\w:/.[\]%#-]+(?: [\w:/.[\]%#-]+)*)?$/;

const nodeAdvancedSchema: z.ZodType<NodeAdvanced> = z.strictObject({
  className: z.string().regex(CLASS_NAMES).optional(),
  attributes: z.record(attributeNameSchema, z.string().max(1000)).optional(),
  anchorId: anchorIdSchema.optional(),
});

const nodeDocSchema: z.ZodType<NodeDoc> = z.object({
  type: z.string().min(1),
  // Props are component-specific; slot arrays inside them are checked when the tree is walked.
  props: z.looseObject({
    id: z.string().min(1),
    layerName: z.string().max(100).optional(),
    hidden: z.boolean().optional(),
    advanced: nodeAdvancedSchema.optional(),
  }),
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

/** The site's own code (C7, Advanced mode). Scripts never run in the editor by default. */
export type SiteCode = {
  /** `custom.css`, added after the site's stylesheet. */
  css: string;
  /** `custom.js`, a classic deferred script. */
  js: string;
  /** HTML added to every page's `<head>`. */
  head: string;
  /** HTML added at the end of every page's `<body>`. */
  bodyEnd: string;
};

/** Validates {@link SiteCode}. */
export const siteCodeSchema: z.ZodType<SiteCode> = z.strictObject({
  css: z.string(),
  js: z.string(),
  head: z.string(),
  bodyEnd: z.string(),
});
