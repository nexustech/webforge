import { isSharedCopy, type NodeDoc, type SiteDoc } from "@webforge/model";
import { CATALOGUE, fieldValueSchema } from "@webforge/site-components/catalogue-data";
import { z } from "zod";
import { isSlot, type Location, locate, locationSchema, nodesAt } from "./locations.js";

/** A node in a page tree: what it is, and what its slots hold. */
type TreeNode = {
  readonly id: string;
  readonly type: string;
  /** Its component's name ("Hero"), or the name the person gave it in Layers. */
  readonly label: string;
  readonly hidden?: true;
  /** A linked copy shows this shared section: edit it there (`kind: "shared"`). */
  readonly sharedSectionId?: string;
  readonly slots?: Readonly<Record<string, readonly TreeNode[]>>;
};

/** `node` and what its slots hold, as a page tree shows them. */
function treeNode(node: NodeDoc, site: SiteDoc): TreeNode {
  const component = CATALOGUE[node.type];
  const named = typeof node.props.layerName === "string" ? node.props.layerName : undefined;
  if (isSharedCopy(node)) {
    const shared = site.sharedSections[node.props.sharedSectionId];
    return {
      id: node.props.id,
      type: node.type,
      label: named ?? shared?.name ?? node.type,
      ...(node.props.hidden === true ? { hidden: true } : {}),
      sharedSectionId: node.props.sharedSectionId,
    };
  }
  const slots = Object.entries(component?.fields ?? {}).flatMap(([name, field]) => {
    const value = node.props[name];
    return field.kind === "slot" && isSlot(value)
      ? [[name, value.map((child) => treeNode(child, site))] as const]
      : [];
  });
  return {
    id: node.props.id,
    type: node.type,
    label: named ?? component?.label ?? node.type,
    ...(node.props.hidden === true ? { hidden: true } : {}),
    ...(slots.length === 0 ? {} : { slots: Object.fromEntries(slots) }),
  };
}

/** A field's value schema as JSON Schema, for an AI app to read; none when it can't be one. */
function jsonSchema(schema: z.ZodType): unknown {
  try {
    return z.toJSONSchema(schema, { unrepresentable: "any" });
  } catch {
    return undefined;
  }
}

/** The queries AI apps can make (F-AI-1), each with its input and what it reads. */
export const QUERIES = {
  /** The site at a glance: its name, pages, shared sections and theme. */
  outline: {
    description:
      "The open site at a glance: its name, language, home page, pages (id, title, file name, kind, folder), shared sections and theme preset. Start here: the other tools take the ids it gives.",
    input: z.strictObject({}),
    read: (site: SiteDoc) => ({
      name: site.settings.general.name,
      language: site.settings.general.language,
      homePageId: site.homePageId,
      pages: site.pageOrder.flatMap((id) => {
        const page = site.pages[id];
        return page === undefined
          ? []
          : [{ id, title: page.title, slug: page.slug, kind: page.kind, folder: page.folder }];
      }),
      sharedSections: Object.values(site.sharedSections).map(({ id, name }) => ({ id, name })),
      theme: site.theme.preset,
    }),
  },
  /** The elements at a location, as a tree: a page's, the Header's or a shared section's. */
  pageTree: {
    description:
      'The elements at a location, as a tree of ids and types: a page\'s content (kind "page"), the Header or Footer every page shares ("layout"), or a shared section ("shared").',
    input: z.strictObject({ location: locationSchema }),
    read: (site: SiteDoc, { location }: { location: Location }) => {
      const nodes = nodesAt(site, location);
      return nodes === undefined ? undefined : nodes.map((node) => treeNode(node, site));
    },
  },
  /** An element's fields: their kinds, labels and value schemas, and what each holds now. */
  fields: {
    description:
      "One element's fields: each one's kind, label, help, JSON Schema for its value, and what it holds now. Read it before updateFields, which takes these names and values.",
    input: z.strictObject({ location: locationSchema, nodeId: z.string().min(1).max(200) }),
    read: (site: SiteDoc, { location, nodeId }: { location: Location; nodeId: string }) => {
      const nodes = nodesAt(site, location);
      const placed = nodes === undefined ? undefined : locate(nodes, nodeId);
      if (placed === undefined) return undefined;
      const { node } = placed;
      const component = CATALOGUE[node.type];
      const fields = Object.entries(component?.fields ?? {}).flatMap(([name, field]) =>
        // Slots are read through the page tree; Custom Code isn't for AI apps.
        field.kind === "slot" || field.kind === "code"
          ? []
          : [
              [
                name,
                {
                  kind: field.kind,
                  label: field.label,
                  ...(field.help === undefined ? {} : { help: field.help }),
                  schema: jsonSchema(fieldValueSchema(field)),
                  value: node.props[name] ?? component?.defaults[name],
                },
              ] as const,
            ],
      );
      return {
        type: node.type,
        label: component?.label ?? node.type,
        fields: Object.fromEntries(fields),
      };
    },
  },
  /** Site Settings that say what the business is: never publishing, forms or analytics. */
  settings: {
    description:
      "Site Settings that say what the business is: its name, address, social profiles, contact details and search settings. Never publishing, forms or analytics.",
    input: z.strictObject({}),
    read: (site: SiteDoc) => {
      const { general, address, social, contact, search } = site.settings;
      return { general, address, social, contact, search };
    },
  },
  /** The theme's tokens: colours, fonts, corners, spacing… */
  theme: {
    description:
      "The theme's tokens (colours, fonts, corners, spacing and the rest), as setThemeTokens takes them.",
    input: z.strictObject({}),
    read: (site: SiteDoc) => site.theme,
  },
} as const;

/** The name of a query. */
export type QueryName = keyof typeof QUERIES;
