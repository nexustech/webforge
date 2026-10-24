import { z } from "zod";
import { anchorIdSchema } from "./link.js";
import { type ThemeTokens, themeTokensSchema } from "./theme.js";

/** The longest name an element can be given in Layers (F-ED-26). */
export const LAYER_NAME_MAX = 100;

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

/** The site's theme: its design tokens (2.1). */
export type Theme = ThemeTokens;

/**
 * Attribute names Advanced mode accepts: `data-*`, `aria-*` and a few harmless global attributes.
 * An allow-list, so nothing can add event handlers, inline styles or `javascript:` URLs.
 */
export const attributeNameSchema = z
  .string()
  .regex(/^(?:data-[a-z0-9-]+|aria-[a-z]+|role|title|lang|dir|translate|tabindex)$/);

const CLASS_NAMES = /^(?:[\w:/.[\]%#-]+(?: [\w:/.[\]%#-]+)*)?$/;

/** Space-separated CSS class names (Tailwind's included), as Advanced mode accepts them. */
export const classNamesSchema = z.string().regex(CLASS_NAMES);

/** A node's Advanced-mode options, as a site file and the renderers accept them. */
export const nodeAdvancedSchema: z.ZodType<NodeAdvanced> = z.strictObject({
  className: classNamesSchema.optional(),
  attributes: z.record(attributeNameSchema, z.string().max(1000)).optional(),
  anchorId: anchorIdSchema.optional(),
});

/**
 * Whether `value` is a slot: an array in a node's props holding nodes (a Section's `content`). Any
 * object in it with `props` counts, so a broken node (`{ type: 5, props: null }`) can't pass as a
 * plain list item. A list field's items never have `props` (`defineComponent` refuses such a
 * field), so an item with a field called `type` is still a list item.
 */
const isSlot = (value: unknown): value is readonly unknown[] =>
  Array.isArray(value) &&
  value.some((item) => typeof item === "object" && item !== null && "props" in item);

/**
 * A node as files and IPC carry it, with every node in its slots at any depth (R14). Props are
 * component-specific beyond the common ones; the component's own fields are checked where it
 * renders. Always used inside {@link withoutUnsafeKeys}, whose depth limit keeps this recursion
 * shallow.
 */
export const nodeDocSchema: z.ZodType<NodeDoc> = z.object({
  type: z.string().min(1),
  props: z
    .looseObject({
      id: z.string().min(1),
      layerName: z.string().max(LAYER_NAME_MAX).optional(),
      hidden: z.boolean().optional(),
      advanced: nodeAdvancedSchema.optional(),
    })
    .superRefine((props, context) => {
      for (const [key, value] of Object.entries(props)) {
        if (!isSlot(value)) continue;
        for (const [index, item] of value.entries()) {
          const node = nodeDocSchema.safeParse(item);
          for (const issue of node.success ? [] : node.error.issues) {
            context.addIssue({
              code: "custom",
              message: issue.message,
              path: [key, index, ...issue.path],
            });
          }
        }
      }
    }),
});

/**
 * Keys that reach an object's prototype or constructor when code copies or merges them naively
 * (prototype pollution). Documents come from files a person may open from anywhere, so none may
 * hold such a key, at any depth.
 */
const UNSAFE_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

/**
 * How deeply a document may nest objects and arrays (R14): far deeper than any page needs (a node
 * takes three levels: itself, its props and a slot), and shallow enough that the code walking a
 * tree, which recurses, never overflows the stack.
 */
const MAX_DOCUMENT_DEPTH = 200;

/**
 * What makes `value` unsafe to take in: a key in {@link UNSAFE_KEYS} at any depth, or nesting
 * deeper than {@link MAX_DOCUMENT_DEPTH}. Undefined if it's neither.
 */
function documentIssue(value: unknown): string | undefined {
  // Iterative: a crafted file nested very deeply can't overflow the stack here.
  const pending: [unknown, number][] = [[value, 0]];
  // Structured clone (IPC) keeps cycles, and this runs before zod refuses anything: each object
  // is visited once, so a cycle can't loop forever.
  const seen = new WeakSet<object>();
  while (pending.length > 0) {
    const [item, depth] = pending.pop() ?? [undefined, 0];
    // Image bytes (a snapshot's `media[].data`) have no keys worth checking, only millions of
    // indices.
    if (typeof item !== "object" || item === null || ArrayBuffer.isView(item) || seen.has(item)) {
      continue;
    }
    if (depth > MAX_DOCUMENT_DEPTH) {
      return `Documents may not nest deeper than ${MAX_DOCUMENT_DEPTH} levels`;
    }
    seen.add(item);
    for (const key of Object.keys(item)) {
      if (UNSAFE_KEYS.has(key)) {
        return `Documents may not contain a "${key}" key`;
      }
      pending.push([(item as Record<string, unknown>)[key], depth + 1]);
    }
  }
  return undefined;
}

/**
 * `schema`, refusing input with an unsafe key anywhere, or nested too deeply, before zod copies
 * any of it. Used for everything that can come from a file: node trees here, and whole sites
 * (`siteDocSchema`).
 */
export function withoutUnsafeKeys<T>(schema: z.ZodType<T>): z.ZodType<T> {
  return z
    .unknown()
    .superRefine((value, context) => {
      const issue = documentIssue(value);
      if (issue !== undefined) {
        context.addIssue({ code: "custom", message: issue });
      }
    })
    .pipe(schema);
}

/** Validates a {@link PageDoc} arriving from outside (IPC, files). */
export const pageDocSchema: z.ZodType<PageDoc> = withoutUnsafeKeys(
  z.object({
    root: z.object({ props: z.record(z.string(), z.unknown()) }),
    content: z.array(nodeDocSchema),
  }),
);

/** Validates a {@link LayoutDoc} arriving from outside (IPC, files). */
export const layoutDocSchema: z.ZodType<LayoutDoc> = withoutUnsafeKeys(
  z.object({
    header: z.array(nodeDocSchema),
    footer: z.array(nodeDocSchema),
  }),
);

/** Validates a {@link Theme}: the site's design tokens (2.1). */
export const themeSchema: z.ZodType<Theme> = themeTokensSchema;

/** Whether `value` looks like a {@link NodeDoc}; used to find slot arrays inside props. */
export function isNodeDoc(value: unknown): value is NodeDoc {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { type, props } = value as { type?: unknown; props?: { id?: unknown } };
  return typeof type === "string" && typeof props?.id === "string";
}

/** The section anchors (`advanced.anchorId`) of `nodes` and everything in them. */
export function anchorsIn(nodes: readonly unknown[], found = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (typeof node !== "object" || node === null) continue;
    const props = (node as { props?: Record<string, unknown> }).props ?? {};
    const anchor = (props.advanced as { anchorId?: unknown } | undefined)?.anchorId;
    if (typeof anchor === "string" && anchor !== "") found.add(anchor);
    for (const value of Object.values(props)) {
      if (Array.isArray(value)) anchorsIn(value, found);
    }
  }
  return found;
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
