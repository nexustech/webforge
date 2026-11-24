import { effectiveValues, isSharedCopy, type NodeDoc, type SiteDoc } from "@webforge/model";
import {
  CATALOGUE,
  fieldValueSchema,
  ICON_NAMES_TAKEN,
} from "@webforge/site-components/catalogue-data";
import { z } from "zod";
import {
  componentDetail,
  componentSummaries,
  isSharedStyleField,
  jsonSchema,
  type Place,
  styleFieldDetails,
  usableComponents,
} from "./catalogue.js";
import { isSlot, type Location, locate, locationSchema, nodesAt } from "./locations.js";

/** The most icon names one answer lists: a search narrows them (#1250). */
const ICONS_LISTED = 200;

/** A node in a page tree: what it is, and what its slots hold. */
type TreeNode = {
  readonly id: string;
  readonly type: string;
  /** Its component's name ("Hero"), or the name the person gave it in Layers. */
  readonly label: string;
  readonly hidden?: true;
  /**
   * Its anchor (Advanced), if it has one: a link to it on its page is
   * `webforge:page/<pageId>#<anchor>` in rich text, or a page link with `anchor` (#1374).
   */
  readonly anchor?: string;
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
  const anchor = node.props.advanced?.anchorId;
  return {
    id: node.props.id,
    type: node.type,
    label: named ?? component?.label ?? node.type,
    ...(node.props.hidden === true ? { hidden: true } : {}),
    ...(typeof anchor === "string" && anchor !== "" ? { anchor } : {}),
    ...(slots.length === 0 ? {} : { slots: Object.fromEntries(slots) }),
  };
}

/**
 * Why a query has nothing to give, in words of its own: a query's `read` answers with one where
 * "that isn't there" wouldn't help (a type there isn't lists the ones there are).
 */
export class QueryRefusal {
  constructor(
    readonly status: "invalid" | "not-found",
    readonly message: string,
  ) {}
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
      'The elements at a location, as a tree of ids and types: a page\'s content (kind "page"), the Header or Footer every page shares ("layout"), or a shared section ("shared"). An element with an anchor gives it: a link goes to it as webforge:page/<pageId>#<anchor> in rich text, or a page link with that anchor.',
    input: z.strictObject({ location: locationSchema }),
    read: (site: SiteDoc, { location }: { location: Location }) => {
      const nodes = nodesAt(site, location);
      return nodes === undefined ? undefined : nodes.map((node) => treeNode(node, site));
    },
  },
  /** An element's fields: their kinds, labels and value schemas, and what each holds now. */
  fields: {
    description: `One element's fields: each of its own fields' kind, label, help, JSON Schema for its value, what it holds now, and where that comes from: "own" (set on the element), "look" (the theme's look for its kind, which every one of them takes unless it sets its own) or "default". The styling fields it shares with other types come in styleFields with what each holds and where from; their schemas are in the styleFields query, or here with styles. Read it before updateFields, which takes these names and values.`,
    input: z.strictObject({
      location: locationSchema,
      nodeId: z.string().min(1).max(200),
      /** The shared styling fields in full too, as each own field is (#1250). */
      styles: z.boolean().optional(),
    }),
    read: (
      site: SiteDoc,
      {
        location,
        nodeId,
        styles = false,
      }: { location: Location; nodeId: string; styles?: boolean | undefined },
    ) => {
      const nodes = nodesAt(site, location);
      const placed = nodes === undefined ? undefined : locate(nodes, nodeId);
      if (placed === undefined) return undefined;
      const { node } = placed;
      const component = CATALOGUE[node.type];
      // What the element draws with, as the export draws it (#670).
      const drawn = effectiveValues(
        node.type,
        node.props,
        component?.defaults ?? {},
        site.theme.looks,
      );
      const listed = Object.entries(component?.fields ?? {}).filter(
        // Slots are read through the page tree; Custom Code isn't for AI apps.
        ([, field]) => field.kind !== "slot" && field.kind !== "code",
      );
      const held = (name: string) => ({
        value: drawn.values[name],
        ...(drawn.sources[name] === undefined ? {} : { source: drawn.sources[name] }),
      });
      // The styling fields it shares with other types, by what they hold only (#1250).
      const shared = styles ? [] : listed.filter(([name]) => isSharedStyleField(name));
      const fields = listed.flatMap(([name, field]) =>
        !styles && isSharedStyleField(name)
          ? []
          : [
              [
                name,
                {
                  kind: field.kind,
                  label: field.label,
                  ...(field.help === undefined ? {} : { help: field.help }),
                  schema: jsonSchema(fieldValueSchema(field)),
                  value: drawn.values[name],
                  ...(drawn.sources[name] === undefined ? {} : { source: drawn.sources[name] }),
                },
              ] as const,
            ],
      );
      return {
        type: node.type,
        label: component?.label ?? node.type,
        fields: Object.fromEntries(fields),
        ...(shared.length === 0
          ? {}
          : { styleFields: Object.fromEntries(shared.map(([name]) => [name, held(name)])) }),
      };
    },
  },
  /** The names an icon field takes (#1251): all of them, or those with `search` in them. */
  icons: {
    description: `The names an icon field takes (Webforge's icons, which are Lucide's), A to Z, with how many there are: with search, only those with it in their name (phone, arrow, star). At most ${ICONS_LISTED} at a time: a search narrows them. An icon field refuses any other name.`,
    input: z.strictObject({ search: z.string().trim().min(1).max(40).optional() }),
    read: (_site: SiteDoc, { search }: { readonly search?: string | undefined }) => {
      const wanted = search?.toLowerCase();
      const found =
        wanted === undefined
          ? ICON_NAMES_TAKEN
          : ICON_NAMES_TAKEN.filter((name) => name.includes(wanted));
      return { count: found.length, names: found.slice(0, ICONS_LISTED) };
    },
  },
  /** The styling fields components share, each once (#1250). */
  styleFields: {
    description:
      "The styling fields section and element types share (their Appearance: font, size, colours, background, spacing, border…), each once, by name: its kind, label, help and the JSON Schema of its value. components and fields name the ones a type has; set them with updateFields like any other field.",
    input: z.strictObject({}),
    read: () => styleFieldDetails(),
  },
  /** Site Settings that say what the business is: never publishing, forms or analytics. */
  settings: {
    description:
      "Site Settings that say what the business is: its name, address, social profiles, contact details and search settings. general holds the logo the Header shows and the site's icon, as Media ids, when they're set: pictureColours gives their colours, and updateSettings sets or clears them, choosing a picture in Media, once the person allows it. Never publishing, forms or analytics.",
    input: z.strictObject({}),
    read: (site: SiteDoc) => {
      const { general, address, social, contact, search } = site.settings;
      return { general, address, social, contact, search };
    },
  },
  /**
   * The catalogue (AIB-1): every type AI apps may add, at a glance, or one type in full, so an app
   * can choose what to add and fill its fields before adding it.
   */
  components: {
    description:
      "The section and element types you can add. Without type: each type's place (section, element or child), label and category, place narrowing them. With type: its own fields (kind, label, help, JSON Schema of the value; a slot's types), presets and defaults, as addNode and updateFields take them, and the styling fields it shares with other types by name (styleFields), whose schemas the styleFields query gives once; with styles, those in full too. The catalogue resource holds them all at once.",
    input: z.strictObject({
      type: z.string().min(1).max(64).optional(),
      place: z.enum(["section", "element", "child"]).optional(),
      /** With a type: its shared styling fields in full too (#1250). */
      styles: z.boolean().optional(),
    }),
    read: (
      _site: SiteDoc,
      {
        type,
        place,
        styles,
      }: { type?: string | undefined; place?: Place | undefined; styles?: boolean | undefined },
    ) => {
      if (type === undefined) return componentSummaries(place);
      return (
        componentDetail(type, { styles: styles === true }) ??
        new QueryRefusal(
          "invalid",
          `There is no component "${type}". There are: ${usableComponents()
            .map(([each]) => each)
            .join(", ")}.`,
        )
      );
    },
  },
  /**
   * The site's Media (4.12b, AIB-7): each picture and file, to place by id. Pictures go in Image
   * fields as `{ mediaId }`; requestMedia asks the person for more.
   */
  media: {
    description: `The site's Media: each picture and file by id, with its file name, kind ("image" or "file"), type, a picture's width, height and alt text, and a file's size in bytes. The picture Site Settings use as the logo, or the site's icon, says so (usedAs). Put a picture in an Image field with updateFields, as { "mediaId": id }; pictureColours gives its main colours. runSiteCheck's templateImages tip lists those still the template's; requestMedia asks the person for their own.`,
    input: z.strictObject({}),
    read: (site: SiteDoc) =>
      Object.values(site.media).map((item) => {
        if (item.kind !== "image") {
          return {
            id: item.id,
            fileName: item.fileName,
            kind: item.kind,
            mimeType: item.mimeType,
            ...(item.size === undefined ? {} : { size: item.size }),
          };
        }
        // What Site Settings use it as (#1373); updateSettings sets them, always asking (UA-8).
        const { logo, icon } = site.settings.general;
        const usedAs = [
          ...(logo === item.id ? ["logo"] : []),
          ...(icon === item.id ? ["icon"] : []),
        ];
        return {
          id: item.id,
          fileName: item.fileName,
          kind: item.kind,
          mimeType: item.mimeType,
          width: item.width,
          height: item.height,
          alt: item.alt,
          ...(usedAs.length === 0 ? {} : { usedAs }),
        };
      }),
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
